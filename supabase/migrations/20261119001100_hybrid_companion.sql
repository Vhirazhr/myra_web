-- MYRA Hybrid Companion Engine and relationship progression
-- Safe defaults: new conversations use hybrid chat/roleplay, relationships
-- begin as friends, and proactive messages are opt-in at both levels.

alter table public.conversations
  drop constraint if exists conversations_mode_check;

alter table public.conversations
  add constraint conversations_mode_check
  check (mode in ('natural', 'learning', 'immersion', 'hybrid'));

alter table public.conversations
  alter column mode set default 'hybrid';

alter table public.conversations
  add column if not exists relationship_stage text not null default 'Best friends';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conversations_relationship_stage_check'
      and conrelid = 'public.conversations'::regclass
  ) then
    alter table public.conversations
      add constraint conversations_relationship_stage_check
      check (relationship_stage in (
        'Best friends',
        'Growing closer',
        'Developing feelings',
        'Romantic partners'
      ));
  end if;
end $$;

alter table public.messages
  add column if not exists is_proactive boolean not null default false;

create index if not exists messages_conversation_created_desc_idx
  on public.messages (conversation_id, created_at desc);

-- Mark worker-generated first messages so the worker never sends repeated
-- unsolicited messages until the user replies.
create or replace function public.finish_initiative(
  actor uuid,
  thread uuid,
  speaker uuid,
  body text,
  job text,
  token uuid
) returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  update myra_private.jobs
  set finished=true
  where owner_id=actor and job_key=job and lease=token and not finished;

  if not found then
    raise exception 'Initiative lease expired';
  end if;

  update public.conversations
  set last_proactive_at=now()
  where id=thread
    and owner_id=actor
    and character_id=speaker
    and proactive;

  if found then
    insert into public.messages(
      owner_id, conversation_id, character_id, role, body, is_proactive
    )
    values(actor, thread, speaker, 'assistant', body, true);
  end if;
end $$;
