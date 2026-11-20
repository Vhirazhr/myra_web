-- Preserve existing rows during rollout and reject credential values on future writes.
alter table public.providers add constraint providers_secret_variable_name
  check (secret_name = '' or secret_name ~ '^[A-Z][A-Z0-9_]{0,80}_API_KEY$') not valid;
