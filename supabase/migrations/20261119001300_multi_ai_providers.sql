-- Expand provider configuration without ever storing API key values in Postgres.
alter table public.providers drop constraint if exists providers_adapter_check;
alter table public.providers
  add constraint providers_adapter_check
  check (adapter in ('gemini','openrouter','openai','anthropic','compatible'));
alter table public.providers
  add column if not exists base_url text not null default '',
  add column if not exists secret_name text not null default '',
  add column if not exists supports_vision boolean not null default false;
update public.providers
set supports_vision = adapter in ('gemini','openai','anthropic','openrouter')
where supports_vision = false;
