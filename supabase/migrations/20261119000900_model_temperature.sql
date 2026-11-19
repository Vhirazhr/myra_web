alter table public.providers add column temperature numeric not null default 0.7 check(temperature between 0 and 2);
