-- Run with psql -v ON_ERROR_STOP=1 after migrations.
begin;
do $$
declare r record;
begin
 if exists(select from pg_tables where schemaname='public' and not rowsecurity and tablename in
  ('admin_access','characters','universes','conversations','messages','memories','stories','devices','settings','usage_logs','audit_logs')) then
  raise exception 'RLS required on private MYRA tables';
 end if;
 if has_table_privilege('authenticated','public.admin_access','insert') or has_table_privilege('anon','public.characters','select')
 or has_table_privilege('authenticated','public.usage_logs','update') then raise exception 'Unexpected table grant'; end if;
 for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('claim_ai_job','release_ai_job','finish_ai_reply','admit_myra_request',
    'claim_notifications','pending_devices','mark_delivered','finish_initiative','tick_simulation') loop
  if has_function_privilege('anon',r.oid,'execute') or has_function_privilege('authenticated',r.oid,'execute')
   or not has_function_privilege('service_role',r.oid,'execute') then raise exception 'Incorrect function grants for %',r.proname; end if;
 end loop;
 if (select count(*) from storage.buckets where not public and id in ('character-avatars','character-gallery','stories','conversation-media','voice-media','universe-covers'))<>6 then
  raise exception 'Missing private storage buckets';
 end if;
 if not exists(select from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
  raise exception 'Missing Realtime publication';
 end if;
end $$;
rollback;
