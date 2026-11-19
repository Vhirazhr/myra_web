create function public.character_activity_counts() returns table(character_id uuid,name text,messages bigint)
language sql stable security invoker set search_path='' as $$
 select c.id,c.name,count(m.id) from public.characters c join public.messages m on m.character_id=c.id group by c.id,c.name order by count(m.id) desc,c.name limit 8;
$$;
create function public.usage_by_day() returns table(day date,requests bigint,tokens bigint) language sql stable security invoker set search_path='' as $$
 select d::date,count(l.id),coalesce(sum(coalesce(l.input_tokens,0)+coalesce(l.output_tokens,0)),0)
 from generate_series(current_date-6,current_date,interval '1 day') d left join public.usage_logs l on l.created_at>=d and l.created_at<d+interval '1 day'
 group by d order by d;
$$;
revoke all on function public.character_activity_counts(),public.usage_by_day() from public,anon;
grant execute on function public.character_activity_counts(),public.usage_by_day() to authenticated;
create index audit_recent on public.audit_logs(owner_id,created_at desc);
create index usage_recent on public.usage_logs(owner_id,created_at desc);
create index conversation_history on public.messages(owner_id,conversation_id,created_at desc,id desc);
