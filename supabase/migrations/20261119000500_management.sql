create table myra_private.backups (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users on delete cascade,
 created_at timestamptz not null default now(), contents jsonb not null
);
create function myra_private.backup_tables() returns text[] language sql immutable as $$
 select array['characters', 'universes', 'universe_characters', 'world_entries', 'crossovers', 'relationships', 'interactions', 'groups', 'group_members', 'conversations', 'messages', 'message_reactions', 'memories', 'stories', 'story_activity', 'media_assets', 'schedules', 'diaries', 'events', 'settings', 'providers', 'calls']::text[]
$$;
create function public.create_myra_backup() returns uuid language plpgsql security definer set search_path='' as $$
declare t text; dataset jsonb:='{}'; slice jsonb; backup_id uuid; actor uuid:=auth.uid();
begin
 if not public.is_myra_admin() then raise exception 'Admin required'; end if;
 foreach t in array myra_private.backup_tables() loop
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by created_at,id),''[]'') from public.%I r where owner_id=$1',t) into slice using actor;
   dataset:=dataset||jsonb_build_object(t,slice);
 end loop;
 insert into myra_private.backups(owner_id,contents) values(actor,dataset) returning id into backup_id; return backup_id;
end $$;
create function public.list_myra_backups() returns table(id uuid,created_at timestamptz,bytes int) language sql stable security definer set search_path='' as $$
 select id,created_at,pg_column_size(contents) from myra_private.backups where owner_id=auth.uid() and public.is_myra_admin() order by created_at desc;
$$;
create function public.restore_myra_backup(backup_id uuid) returns int language plpgsql security definer set search_path='' as $$
declare t text; dataset jsonb; added int; total int:=0;
begin
 select contents into strict dataset from myra_private.backups where id=backup_id and owner_id=auth.uid() and public.is_myra_admin();
 foreach t in array myra_private.backup_tables() loop
   execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1) on conflict do nothing',t,t) using dataset->t;
   get diagnostics added=row_count; total:=total+added;
 end loop; return total;
end $$;
create function public.workspace_metrics() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('Characters',(select count(*) from public.characters),'Universes',(select count(*) from public.universes),'Conversations',(select count(*) from public.conversations),'Groups',(select count(*) from public.groups),'Messages',(select count(*) from public.messages),'AI requests',(select count(*) from public.usage_logs),'Tokens',(select coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)),0) from public.usage_logs),'Estimated USD',(select sum(cost) from public.usage_logs),'Storage MB',(select round(coalesce(sum((metadata->>'size')::numeric),0)/1048576,2) from storage.objects where split_part(name,'/',1)=auth.uid()::text),'Voice minutes',(select round(coalesce(sum(extract(epoch from ended_at-started_at))/60,0),1) from public.calls where state='ended'));
$$;
do $$ declare fn regprocedure; begin
 foreach fn in array array['public.workspace_metrics()'::regprocedure,'public.create_myra_backup()'::regprocedure,'public.list_myra_backups()'::regprocedure,'public.restore_myra_backup(uuid)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon',fn); execute format('grant execute on function %s to authenticated',fn);
 end loop;
end $$;
