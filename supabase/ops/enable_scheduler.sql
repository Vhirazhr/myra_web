-- Run once in the target project's SQL editor after creating the Vault secrets
-- myra_worker_url and myra_worker_token and deploying the worker function.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$ begin
 if not exists (select from vault.decrypted_secrets where name='myra_worker_url' and decrypted_secret like 'https://%/functions/v1/worker')
 or not exists (select from vault.decrypted_secrets where name='myra_worker_token' and length(decrypted_secret)>=32) then
   raise exception 'Configure the MYRA worker URL and token in Supabase Vault first';
 end if;
end $$;
select cron.schedule('myra-worker','* * * * *',$job$
 select net.http_post(
  url:=(select decrypted_secret from vault.decrypted_secrets where name='myra_worker_url'),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='myra_worker_token')),
  body:='{}'::jsonb,timeout_milliseconds:=120000
 );
$job$);
commit;
