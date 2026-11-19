-- Decouple optional memory extraction from the user-facing reply and support
-- incremental assistant-message updates while Gemini streams its response.

alter table public.messages
  add column if not exists is_streaming boolean not null default false;

create table public.memory_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  source_message_id uuid not null,
  assistant_message_id uuid not null,
  conversation_id uuid not null,
  character_id uuid not null,
  memory_mode text not null check (memory_mode in ('automatic','remember','private')),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  attempts integer not null default 0 check (attempts between 0 and 10),
  available_at timestamptz not null default now(),
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_message_id, character_id),
  foreign key (owner_id, source_message_id) references public.messages(owner_id,id) on delete cascade,
  foreign key (owner_id, assistant_message_id) references public.messages(owner_id,id) on delete cascade,
  foreign key (owner_id, conversation_id) references public.conversations(owner_id,id) on delete cascade,
  foreign key (owner_id, character_id) references public.characters(owner_id,id) on delete cascade
);

create index memory_tasks_pending
  on public.memory_tasks (available_at, created_at)
  where status in ('pending','processing');

alter table public.memory_tasks enable row level security;
revoke all on public.memory_tasks from public, anon, authenticated;
grant all on public.memory_tasks to service_role;

create function public.start_ai_reply(
  actor uuid, job text, token uuid, source uuid, speaker uuid
) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.conversations; reply uuid;
begin
  if not exists (
    select 1 from myra_private.jobs
    where owner_id=actor and job_key=job and lease=token and not finished
  ) then raise exception 'Generation lease expired'; end if;

  select c0.* into strict c
  from public.conversations c0
  join public.messages m on m.conversation_id=c0.id
  where m.id=source and m.owner_id=actor and m.role='user'
    and (c0.character_id=speaker or exists(
      select 1 from public.group_members gm
      where gm.group_id=c0.group_id and gm.character_id=speaker
    ));

  select id into reply from public.messages
  where owner_id=actor and source_id=source and character_id=speaker;

  if reply is null then
    insert into public.messages(
      owner_id,conversation_id,character_id,role,body,source_id,is_streaming
    ) values(actor,c.id,speaker,'assistant','…',source,true)
    returning id into reply;
  else
    update public.messages
    set body='…',is_streaming=true
    where id=reply and owner_id=actor
    returning id into reply;
  end if;

  return reply;
end $$;

create function public.update_ai_reply(
  actor uuid, job text, token uuid, reply uuid, answer text
) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists (
    select 1 from myra_private.jobs
    where owner_id=actor and job_key=job and lease=token and not finished
  ) then raise exception 'Generation lease expired'; end if;

  update public.messages
  set body=left(answer,24000)
  where id=reply and owner_id=actor and role='assistant' and is_streaming;

  if not found then raise exception 'Streaming reply is no longer active'; end if;
end $$;

create or replace function public.finish_ai_reply(
  actor uuid, job text, token uuid, source uuid, speaker uuid,
  answer text, fact text, fact_type text
) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.conversations; reply uuid; scope_name text;
begin
  update myra_private.jobs
  set finished=true
  where owner_id=actor and job_key=job and lease=token and not finished;
  if not found then raise exception 'Generation lease expired'; end if;

  select c0.* into strict c
  from public.conversations c0
  join public.messages m on m.conversation_id=c0.id
  where m.id=source and m.owner_id=actor and m.role='user'
    and (c0.character_id=speaker or exists(
      select 1 from public.group_members gm
      where gm.group_id=c0.group_id and gm.character_id=speaker
    ));

  select id into reply from public.messages
  where owner_id=actor and source_id=source and character_id=speaker;

  if reply is null then
    insert into public.messages(
      owner_id,conversation_id,character_id,role,body,source_id,is_streaming
    ) values(actor,c.id,speaker,'assistant',left(answer,24000),source,false)
    returning id into reply;
  else
    update public.messages
    set body=left(answer,24000),is_streaming=false
    where id=reply and owner_id=actor
    returning id into reply;
  end if;

  -- Preserve the legacy synchronous path for callers that explicitly pass a fact.
  if nullif(trim(fact),'') is not null then
    scope_name:=case
      when fact_type='thread_only' then 'personal'
      when c.crossover_id is not null then 'crossover'
      when c.universe_id is not null then 'universe'
      when c.group_id is not null then 'group'
      when fact_type='user' then 'user'
      when fact_type='personal' then 'personal'
      else 'character'
    end;
    insert into public.memories(
      owner_id,scope,body,source_id,character_id,conversation_id,
      group_id,universe_id,crossover_id
    ) values(
      actor,scope_name,left(fact,6000),reply,
      case when scope_name='character' then speaker end,
      case when scope_name='personal' then c.id end,
      case when scope_name='group' then c.group_id end,
      case when scope_name='universe' then c.universe_id end,
      case when scope_name='crossover' then c.crossover_id end
    );
  elsif fact_type in ('automatic','remember','private') then
    insert into public.memory_tasks(
      owner_id,source_message_id,assistant_message_id,conversation_id,character_id,memory_mode
    ) values(actor,source,reply,c.id,speaker,fact_type)
    on conflict(source_message_id,character_id) do nothing;
  end if;

  return reply;
end $$;

create function public.claim_memory_tasks(batch_size integer default 2)
returns setof public.memory_tasks
language plpgsql security definer set search_path='' as $$
begin
  return query
  with candidates as (
    select id
    from public.memory_tasks
    where (status='pending' and available_at<=now())
       or (status='processing' and updated_at<now()-interval '3 minutes')
    order by available_at,created_at
    limit greatest(1,least(coalesce(batch_size,2),5))
    for update skip locked
  )
  update public.memory_tasks t
  set status='processing',attempts=t.attempts+1,updated_at=now()
  from candidates c
  where t.id=c.id
  returning t.*;
end $$;

create function public.finish_memory_task(task_id uuid, fact text)
returns void
language plpgsql security definer set search_path='' as $$
declare
  t public.memory_tasks;
  c public.conversations;
  source_body text;
  fact_text text;
  fact_type text;
  scope_name text;
begin
  select * into t from public.memory_tasks where id=task_id for update;
  if not found or t.status<>'processing' then return; end if;

  select * into strict c
  from public.conversations
  where id=t.conversation_id and owner_id=t.owner_id;

  select body into strict source_body
  from public.messages
  where id=t.source_message_id and owner_id=t.owner_id and role='user';

  if t.memory_mode='remember' then
    fact_text:=source_body;
    fact_type:='user';
  elsif t.memory_mode='private' then
    fact_text:=coalesce(fact,'');
    fact_type:='thread_only';
  else
    fact_text:=coalesce(fact,'');
    fact_type:='character';
  end if;

  if nullif(trim(fact_text),'') is not null
     and upper(trim(fact_text)) not in ('NONE','NONE.') then
    scope_name:=case
      when fact_type='thread_only' then 'personal'
      when c.crossover_id is not null then 'crossover'
      when c.universe_id is not null then 'universe'
      when c.group_id is not null then 'group'
      when fact_type='user' then 'user'
      when fact_type='personal' then 'personal'
      else 'character'
    end;

    insert into public.memories(
      owner_id,scope,body,source_id,character_id,conversation_id,
      group_id,universe_id,crossover_id
    ) values(
      t.owner_id,scope_name,left(fact_text,6000),t.assistant_message_id,
      case when scope_name='character' then t.character_id end,
      case when scope_name='personal' then t.conversation_id end,
      case when scope_name='group' then c.group_id end,
      case when scope_name='universe' then c.universe_id end,
      case when scope_name='crossover' then c.crossover_id end
    )
    on conflict do nothing;
  end if;

  update public.memory_tasks
  set status='completed',last_error='',updated_at=now()
  where id=task_id;
end $$;

create or replace function myra_private.notify_activity()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(
    select from public.settings
    where owner_id=new.owner_id and not notifications
  ) then return new; end if;

  if tg_table_name='messages' then
    if tg_op='INSERT' then
      if new.role='assistant' and not new.is_streaming then
        insert into public.notifications(owner_id,name,body,conversation_id)
        values(new.owner_id,'New character message',left(new.body,240),new.conversation_id);
      end if;
    elsif tg_op='UPDATE' then
      if new.role='assistant' and old.is_streaming and not new.is_streaming then
        insert into public.notifications(owner_id,name,body,conversation_id)
        values(new.owner_id,'New character message',left(new.body,240),new.conversation_id);
      end if;
    end if;
  else
    insert into public.notifications(owner_id,name,body,story_id)
    values(new.owner_id,'Story '||new.kind,new.body,new.story_id);
  end if;
  return new;
end $$;

create trigger message_completed_notification
after update of is_streaming on public.messages
for each row when (old.is_streaming and not new.is_streaming)
execute function myra_private.notify_activity();

do $$
declare fn regprocedure;
begin
  foreach fn in array array[
    'public.start_ai_reply(uuid,text,uuid,uuid,uuid)'::regprocedure,
    'public.update_ai_reply(uuid,text,uuid,uuid,text)'::regprocedure,
    'public.finish_ai_reply(uuid,text,uuid,uuid,uuid,text,text,text)'::regprocedure,
    'public.claim_memory_tasks(integer)'::regprocedure,
    'public.finish_memory_task(uuid,text)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public,anon,authenticated',fn);
    execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;
