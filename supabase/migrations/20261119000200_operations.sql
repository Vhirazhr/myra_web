create schema if not exists myra_private;
revoke all on schema myra_private from public,anon,authenticated;

create function myra_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare r record;
begin
  if tg_op='DELETE' then r:=old; else r:=new; end if;
  if not exists(select from auth.users where id=r.owner_id) then return null; end if;
  insert into public.audit_logs(owner_id,operation,entity,record_id) values(r.owner_id,tg_op,tg_table_name,r.id);
  return null;
end $$;
do $$ declare t text; begin
  foreach t in array array['characters','universes','world_entries','groups','relationships','settings','providers','memories','stories','crossovers'] loop
    execute format('create trigger track_changes after insert or update or delete on public.%I for each row execute function myra_private.audit_change()',t);
  end loop;
end $$;
create function myra_private.relationship_change() returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.interactions(owner_id,relationship_id,kind,name,body)
    values(new.owner_id,new.id,'change',new.kind || ' · trust ' || new.trust,new.history);
  return new;
end $$;
create trigger relationship_history after insert or update of trust,kind,history on public.relationships
  for each row execute function myra_private.relationship_change();

-- Create or edit a world/group and its whole roster in one transaction.
create function public.save_roster(target text, record_id uuid, fields jsonb, members uuid[]) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid; member uuid;
begin
  if cardinality(members)>50 then raise exception 'Maximum 50 members'; end if;
  if target='groups' then
    if record_id is null then
      insert into public.groups(name,description,mode) values(fields->>'name',coalesce(fields->>'description',''),fields->>'mode') returning id into result;
    else
      update public.groups set name=fields->>'name',description=coalesce(fields->>'description',''),mode=fields->>'mode' where id=record_id returning id into strict result;
    end if;
    delete from public.group_members where group_id=result;
    insert into public.group_members(group_id,character_id) select result,id from (select distinct unnest(members) id) m;
  elsif target='universes' then
    if record_id is null then
      insert into public.universes(name,description,genre,rules,cover) values(fields->>'name',coalesce(fields->>'description',''),coalesce(fields->>'genre',''),coalesce(fields->>'rules',''),coalesce(fields->>'cover','')) returning id into result;
    else
      update public.universes set name=fields->>'name',description=coalesce(fields->>'description',''),genre=coalesce(fields->>'genre',''),rules=coalesce(fields->>'rules',''),cover=coalesce(fields->>'cover','') where id=record_id returning id into strict result;
    end if;
    delete from public.universe_characters where universe_id=result;
    insert into public.universe_characters(universe_id,character_id) select result,id from (select distinct unnest(members) id) m;
  else raise exception 'Unknown roster'; end if;
  return result;
end $$;

create function public.recall_memories(thread uuid, speaker uuid, query_text text default '') returns setof public.memories
language sql stable security invoker set search_path='' as $$
  select m.* from public.conversations c join public.memories m on m.owner_id=c.owner_id
  where c.id=thread and (c.character_id=speaker or exists(select from public.group_members gm where gm.group_id=c.group_id and gm.character_id=speaker))
    and (m.conversation_id=c.id or case
      when c.crossover_id is not null then m.crossover_id=c.crossover_id
      when c.universe_id is not null then m.universe_id=c.universe_id
      else m.scope='user' or m.character_id=speaker or m.group_id=c.group_id
        or exists(select from public.relationships r where r.id=m.relationship_id and speaker in (r.character_id,r.other_character_id) and exists(select from public.group_members gm where gm.group_id=c.group_id and gm.character_id=case when r.character_id=speaker then r.other_character_id else r.character_id end))
    end)
  order by ts_rank(to_tsvector('simple',m.body),plainto_tsquery('simple',left(query_text,1000))) desc,m.importance desc,m.created_at desc,m.id
  limit coalesce((select memory_limit from public.settings where owner_id=auth.uid()),12)
$$;

create table myra_private.jobs (
  owner_id uuid not null references auth.users on delete cascade,
  job_key text not null,
  lease uuid not null default gen_random_uuid(),
  acquired_at timestamptz not null default now(),
  finished boolean not null default false,
  primary key (owner_id,job_key)
);
create function public.claim_ai_job(actor uuid, job text) returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid;
begin
  if not exists(select from public.admin_access where user_id=actor) then raise exception 'Admin required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  if (select count(*) from myra_private.jobs where owner_id=actor and acquired_at>now()-interval '1 minute')>=20 then raise exception 'Request limit reached'; end if;
  insert into myra_private.jobs(owner_id,job_key) values(actor,job)
  on conflict(owner_id,job_key) do update set acquired_at=now(),lease=gen_random_uuid() where not jobs.finished and jobs.acquired_at < now()-interval '3 minutes' returning lease into token;
  return token;
end $$;
create function public.release_ai_job(actor uuid,job text,token uuid) returns void language sql security definer set search_path='' as $$
 delete from myra_private.jobs where owner_id=actor and job_key=job and lease=token and not finished
$$;
create function public.finish_ai_reply(actor uuid, job text, token uuid, source uuid, speaker uuid, answer text, fact text, fact_type text)
returns uuid language plpgsql security definer set search_path='' as $$
declare c public.conversations; reply uuid; scope_name text;
begin
  update myra_private.jobs set finished=true where owner_id=actor and job_key=job and lease=token and not finished;
  if not found then raise exception 'Generation lease expired'; end if;
  select c0.* into strict c from public.conversations c0 join public.messages m on m.conversation_id=c0.id
    where m.id=source and m.owner_id=actor and m.role='user' and (c0.character_id=speaker or exists(select 1 from public.group_members where group_id=c0.group_id and character_id=speaker));
  insert into public.messages(owner_id,conversation_id,character_id,role,body,source_id) values(actor,c.id,speaker,'assistant',answer,source) returning id into reply;
  if nullif(trim(fact),'') is not null then
    scope_name:=case when fact_type='thread_only' then 'personal' when c.crossover_id is not null then 'crossover' when c.universe_id is not null then 'universe' when c.group_id is not null then 'group' when fact_type='user' then 'user' when fact_type='personal' then 'personal' else 'character' end;
    insert into public.memories(owner_id,scope,body,source_id,character_id,conversation_id,group_id,universe_id,crossover_id)
      values(actor,scope_name,left(fact,6000),reply,case when scope_name='character' then speaker end,case when scope_name='personal' then c.id end,case when scope_name='group' then c.group_id end,case when scope_name='universe' then c.universe_id end,case when scope_name='crossover' then c.crossover_id end);
  end if;
  return reply;
end $$;
-- Prevent client-side impersonation of generated messages.
create policy user_authored on public.messages as restrictive for insert to authenticated with check(role='user' and source_id is null);
create policy edit_user_authored on public.messages as restrictive for update to authenticated using(role='user') with check(role='user' and source_id is null);

create function myra_private.notify_activity() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select from public.settings where owner_id=new.owner_id and not notifications) then return new; end if;
  if tg_table_name='messages' then
    if new.role='assistant' then insert into public.notifications(owner_id,name,body,conversation_id) values(new.owner_id,'New character message',left(new.body,240),new.conversation_id); end if;
  else
    insert into public.notifications(owner_id,name,body,story_id) values(new.owner_id,'Story '||new.kind,new.body,new.story_id);
  end if;
  return new;
end $$;
create trigger message_notifications after insert on public.messages for each row execute function myra_private.notify_activity();
create trigger story_notifications after insert on public.story_activity for each row when(new.kind<>'view') execute function myra_private.notify_activity();

create function public.tick_simulation(actor uuid) returns int language plpgsql security definer set search_path='' as $$
declare pref public.settings; local_now timestamp; item record; n int:=0;
begin
  select * into pref from public.settings where owner_id=actor and simulation for update;
  if not found then return 0; end if;
  local_now:=now() at time zone pref.timezone;
  for item in select * from public.schedules where owner_id=actor and enabled and at_time<=local_now::time and last_run is distinct from local_now::date order by at_time limit 30 for update skip locked loop
    insert into public.diaries(owner_id,character_id,name,body,mood) values(actor,item.character_id,item.name,item.activity,item.mood);
    update public.schedules set last_run=local_now::date where id=item.id;
    n:=n+1;
  end loop;
  for item in select * from public.events where owner_id=actor and executed_at is null and due_at<=now() order by due_at limit 30 for update skip locked loop
    insert into public.diaries(owner_id,character_id,name,body) values(actor,item.character_id,item.name,item.body);
    update public.events set executed_at=now() where id=item.id; n:=n+1;
  end loop;
  update public.settings set last_tick=now() where owner_id=actor;
  return n;
end $$;
create function myra_private.check_timezone() returns trigger language plpgsql set search_path='' as $$
begin perform now() at time zone new.timezone; return new; end $$;
create trigger validate_zone before insert or update of timezone on public.settings for each row execute function myra_private.check_timezone();

do $$ declare fn regprocedure; begin
  foreach fn in array array['public.save_roster(text,uuid,jsonb,uuid[])'::regprocedure,'public.recall_memories(uuid,uuid,text)'::regprocedure] loop
    execute format('revoke all on function %s from public,anon',fn); execute format('grant execute on function %s to authenticated,service_role',fn);
  end loop;
  foreach fn in array array['public.claim_ai_job(uuid,text)'::regprocedure,'public.release_ai_job(uuid,text,uuid)'::regprocedure,'public.finish_ai_reply(uuid,text,uuid,uuid,uuid,text,text,text)'::regprocedure,'public.tick_simulation(uuid)'::regprocedure] loop
    execute format('revoke all on function %s from public,anon,authenticated',fn); execute format('grant execute on function %s to service_role',fn);
  end loop;
end $$;
