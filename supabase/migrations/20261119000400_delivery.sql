alter table public.messages add column transcript text;
alter table public.notifications add column lease_until timestamptz;
alter table public.notifications add column delivery_error text;
alter table public.conversations add column last_proactive_at timestamptz;
create table myra_private.deliveries (
 notification_id uuid references public.notifications on delete cascade,
 device_id uuid references public.devices on delete cascade,
 primary key(notification_id,device_id)
);
create function public.claim_notifications(batch_size integer default 20) returns setof public.notifications
language sql security definer set search_path='' as $$
 update public.notifications n set lease_until=now()+interval '5 minutes' where id in (
 select q.id from public.notifications q join public.admin_access a on a.user_id=q.owner_id
 left join public.settings s on s.owner_id=q.owner_id
 where q.sent_at is null and q.due_at<=now() and coalesce(q.lease_until,'-infinity')<now()
 and exists(select from public.devices d where d.owner_id=q.owner_id) and coalesce(s.notifications,true)
 and not (case when coalesce(s.quiet_start,'22:00'::time)>coalesce(s.quiet_end,'07:00'::time)
 then (now() at time zone coalesce(s.timezone,'Asia/Jakarta'))::time>=coalesce(s.quiet_start,'22:00'::time)
 or (now() at time zone coalesce(s.timezone,'Asia/Jakarta'))::time<coalesce(s.quiet_end,'07:00'::time)
 else (now() at time zone s.timezone)::time>=s.quiet_start and (now() at time zone s.timezone)::time<s.quiet_end end)
 order by q.due_at limit least(batch_size,50) for update of q skip locked) returning n.*
$$;
create function public.pending_devices(notice uuid) returns setof public.devices language sql security definer set search_path='' as $$
 select d.* from public.devices d join public.notifications n on n.owner_id=d.owner_id
 where n.id=notice and not exists(select from myra_private.deliveries a where a.notification_id=notice and a.device_id=d.id)
$$;
create function public.mark_delivered(notice uuid,device uuid) returns void language sql security definer set search_path='' as $$
 insert into myra_private.deliveries values(notice,device) on conflict do nothing
$$;
create function public.finish_initiative(actor uuid,thread uuid,speaker uuid,body text,job text,token uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update myra_private.jobs set finished=true where owner_id=actor and job_key=job and lease=token and not finished;
 if not found then raise exception 'Initiative lease expired'; end if;
 update public.conversations set last_proactive_at=now() where id=thread and owner_id=actor and character_id=speaker and proactive;
 if found then insert into public.messages(owner_id,conversation_id,character_id,role,body) values(actor,thread,speaker,'assistant',body); end if;
end $$;
do $$ declare fn regprocedure; begin
 foreach fn in array array['public.claim_notifications(int)'::regprocedure,'public.pending_devices(uuid)'::regprocedure,'public.mark_delivered(uuid,uuid)'::regprocedure,'public.finish_initiative(uuid,uuid,uuid,text,text,uuid)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon,authenticated',fn); execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;
