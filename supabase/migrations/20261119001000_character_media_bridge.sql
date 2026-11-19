-- MYRA Character Media Bridge
-- Stores Google Flow exports as private, character-linked media and lets
-- assistant messages reference the exact private Storage bucket.

alter table public.media_assets
  add column if not exists description text not null default '',
  add column if not exists tags text[] not null default '{}',
  add column if not exists generation_prompt text not null default '',
  add column if not exists origin text not null default 'upload';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'media_assets_origin_check'
      and conrelid = 'public.media_assets'::regclass
  ) then
    alter table public.media_assets
      add constraint media_assets_origin_check
      check (origin in ('upload', 'google-flow', 'other'));
  end if;
end $$;

create index if not exists media_assets_character_created_idx
  on public.media_assets (owner_id, character_id, created_at desc);

create index if not exists media_assets_tags_idx
  on public.media_assets using gin (tags);

alter table public.messages
  add column if not exists attachment_bucket text not null default 'conversation-media';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'messages_attachment_bucket_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_attachment_bucket_check
      check (attachment_bucket in (
        'conversation-media',
        'voice-media',
        'stories',
        'character-gallery',
        'character-avatars'
      ));
  end if;
end $$;

-- Existing assistant voice notes were stored in the voice-media bucket.
update public.messages
set attachment_bucket = 'voice-media'
where role = 'assistant'
  and mime like 'audio/%'
  and attachment <> ''
  and attachment_bucket = 'conversation-media';
