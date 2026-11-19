-- Guard provider spend for all entry points, including tests and audio.
create table myra_private.request_windows (
 owner_id uuid primary key references auth.users on delete cascade,
 window_start timestamptz not null, requests integer not null
);
create function public.admit_myra_request(actor uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare admitted int;
begin
 insert into myra_private.request_windows(owner_id,window_start,requests) values(actor,now(),1)
 on conflict(owner_id) do update set
   window_start=case when request_windows.window_start<=now()-interval '1 minute' then now() else request_windows.window_start end,
   requests=case when request_windows.window_start<=now()-interval '1 minute' then 1 else request_windows.requests+1 end
 where request_windows.window_start<=now()-interval '1 minute' or request_windows.requests<30
 returning requests into admitted;
 return admitted is not null;
end $$;
revoke all on function public.admit_myra_request(uuid) from public,anon,authenticated;
grant execute on function public.admit_myra_request(uuid) to service_role;

-- Consumers choose a group or world feed. Drafts, future posts and expired
-- stories remain visible only in the owner's editorial studio.
create function public.story_feed(for_group uuid default null,for_universe uuid default null)
returns setof public.stories language sql stable security invoker set search_path='' as $$
 select s.* from public.stories s where status='published' and publish_at<=now() and expires_at>now()
 and (case audience when 'private' then for_group is null and for_universe is null
 when 'group' then group_id=for_group and for_universe is null
 when 'universe' then universe_id=for_universe and for_group is null end)
 order by publish_at desc;
$$;
revoke all on function public.story_feed(uuid,uuid) from public,anon;
grant execute on function public.story_feed(uuid,uuid) to authenticated;
alter table public.schedules add column relationship_id uuid;
alter table public.schedules add constraint schedule_relationship foreign key(owner_id,relationship_id) references public.relationships(owner_id,id) on delete cascade;
alter table public.schedules add column milestone boolean not null default false;
create function myra_private.schedule_interaction() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.relationship_id is not null and new.last_run is distinct from old.last_run and new.last_run is not null then
  insert into public.interactions(owner_id,relationship_id,name,body,kind) select new.owner_id,r.id,new.name,new.activity,
   case when new.milestone then 'milestone' else 'interaction' end from public.relationships r
   where r.id=new.relationship_id and new.character_id in (r.character_id,r.other_character_id);
 end if;
 return new;
end $$;
create trigger simulation_social after update of last_run on public.schedules for each row execute function myra_private.schedule_interaction();
