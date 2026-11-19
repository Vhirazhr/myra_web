alter table public.messages add column memory_mode text not null default 'automatic'
 check(memory_mode in ('automatic','remember','private','off'));
