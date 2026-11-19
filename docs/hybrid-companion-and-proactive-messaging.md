# MYRA Hybrid Companion and Proactive Messaging

This update gives MYRA a hybrid conversation style, explicit per-conversation relationship stages, more varied character replies, and better contextual first messages.

## Deploy

From the project directory:

```cmd
git pull origin main
pnpm install
pnpm exec supabase db push --remote
pnpm exec supabase functions deploy myra --remote=splifnxylqaicneodkaj
pnpm exec supabase functions deploy worker --remote=splifnxylqaicneodkaj
pnpm build
```

## Hybrid roleplay

New conversations default to Hybrid. Existing conversations can be changed in Conversation Settings. Relationship stages are stored per conversation:
- Best friends
- Growing closer
- Developing feelings
- Romantic partners

The model is instructed to respect the selected stage, use the character's complete profile, keep ordinary messages natural, and expand into immersive roleplay when the user invites it. It must not declare a relationship official without mutual agreement.

## Let a character message first

This is opt-in and requires both switches:
1. In MYRA Settings -> Proactive, enable **Enable proactive messaging**.
2. In the relevant conversation's Settings, enable **Allow character-initiated messages**.

Set a timezone, quiet hours, and a reasonable interval (for example, 12 or 24 hours). The worker skips empty conversations and will not send a second proactive message until the user replies to the previous one.

### Configure the worker secret

Generate a long random token locally in Windows CMD:

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Set the exact generated value as a Supabase Edge Function secret:

```cmd
pnpm exec supabase secrets set MYRA_WORKER_TOKEN=PASTE_RANDOM_TOKEN_HERE
pnpm exec supabase functions deploy worker --remote=splifnxylqaicneodkaj
```

Do not put this token in GitHub, frontend environment variables, or a public chat.

### Configure Vault and Supabase Cron

In Supabase Dashboard -> Database -> Extensions, ensure `pg_cron`, `pg_net`, and Vault are enabled.

In SQL Editor, create three Vault secrets. Use your project URL, your existing Supabase publishable key, and the same worker token created above:

```sql
select vault.create_secret('https://splifnxylqaicneodkaj.supabase.co', 'myra_project_url');
select vault.create_secret('YOUR_SUPABASE_PUBLISHABLE_KEY', 'myra_publishable_key');
select vault.create_secret('YOUR_SAME_WORKER_TOKEN', 'myra_worker_token');
```

Then schedule the worker every five minutes:

```sql
select cron.schedule(
  'myra-worker-every-five-minutes',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'myra_project_url')
      || '/functions/v1/worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'myra_publishable_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'myra_worker_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
```

Check the schedule and recent runs:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname = 'myra-worker-every-five-minutes';

select jobid, status, start_time, end_time, return_message
from cron.job_run_details
order by start_time desc
limit 10;
```

If the job already exists, scheduling the same job name updates it. If Vault secrets already exist, update/reuse them rather than creating duplicate names.

## Delivery notes

- The worker writes first messages into the conversation. They appear in MYRA even without Firebase push configured.
- Actual phone/browser push notifications require the separate Firebase Cloud Messaging setup and registered device tokens.
- Proactive messages are generated with the same Gemini API key and model as normal replies, so they consume the Gemini API quota.
- Quiet hours, frequency settings, both opt-in switches, and the no-repeat-before-user-replies guard are respected.
