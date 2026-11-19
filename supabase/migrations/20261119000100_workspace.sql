-- MYRA is private to each provisioned administrator. Composite references enforce
-- ownership even for writes from server-side jobs.
create table public.admin_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_access enable row level security;
revoke all on public.admin_access from public, anon, authenticated;
grant select on public.admin_access to authenticated;
create policy self_membership on public.admin_access for select to authenticated using (user_id=(select auth.uid()));
create function public.is_myra_admin() returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.admin_access where user_id=(select auth.uid()));
$$;
revoke all on function public.is_myra_admin() from public,anon;
grant execute on function public.is_myra_admin() to authenticated,service_role;

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  age integer not null default 24 check (age between 18 and 120),
  pronouns text not null default '',
  gender text not null default '',
  biography text not null default '',
  relationship text not null default '',
  language text not null default 'Indonesian',
  personality jsonb not null default '{}' check (jsonb_typeof(personality)='object'),
  appearance text not null default '',
  background text not null default '',
  communication text not null default '',
  scenario text not null default '',
  voice text not null default 'alloy',
  portrait text not null default '',
  status text not null default 'active' check (status in ('active', 'draft', 'archived')),
  unique (owner_id,id)
);

create table public.universes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  genre text not null default '',
  description text not null default '',
  rules text not null default '',
  cover text not null default '',
  unique (owner_id,id)
);

create table public.universe_characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  universe_id uuid not null,
  character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,universe_id) references public.universes(owner_id,id) on delete cascade,
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  unique (universe_id, character_id)
);
create index on public.universe_characters (universe_id);
create index on public.universe_characters (character_id);

create table public.world_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  body text not null default '',
  kind text not null default 'lore' check (kind in ('lore', 'location', 'event')),
  event_date date,
  universe_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,universe_id) references public.universes(owner_id,id) on delete cascade
);
create index on public.world_entries (universe_id);

create table public.crossovers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  description text not null default '',
  universe_id uuid not null,
  other_universe_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,universe_id) references public.universes(owner_id,id) on delete cascade,
  foreign key (owner_id,other_universe_id) references public.universes(owner_id,id) on delete cascade,
  check (universe_id <> other_universe_id)
);
create index on public.crossovers (universe_id);
create index on public.crossovers (other_universe_id);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null default 'friends' check (kind in ('friends', 'romantic', 'rivals', 'family')),
  trust int not null default 50 check (trust between 0 and 100),
  history text not null default '',
  character_id uuid not null,
  other_character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  foreign key (owner_id,other_character_id) references public.characters(owner_id,id) on delete cascade,
  check (character_id <> other_character_id)
);
create index on public.relationships (character_id);
create index on public.relationships (other_character_id);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  body text not null default '',
  kind text not null default 'interaction' check (kind in ('interaction', 'milestone', 'change')),
  relationship_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,relationship_id) references public.relationships(owner_id,id) on delete cascade
);
create index on public.interactions (relationship_id);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  description text not null default '',
  mode text not null default 'Natural Chat' check (mode in ('Natural Chat', 'Cinematic Roleplay', 'Hybrid')),
  unique (owner_id,id)
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  group_id uuid not null,
  character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,group_id) references public.groups(owner_id,id) on delete cascade,
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  unique (group_id,character_id)
);
create index on public.group_members (group_id);
create index on public.group_members (character_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  language text not null default 'Indonesian',
  mode text not null default 'natural' check (mode in ('natural', 'learning', 'immersion')),
  proactive boolean not null default false,
  character_id uuid,
  group_id uuid,
  universe_id uuid,
  crossover_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  foreign key (owner_id,group_id) references public.groups(owner_id,id) on delete cascade,
  foreign key (owner_id,universe_id) references public.universes(owner_id,id) on delete cascade,
  foreign key (owner_id,crossover_id) references public.crossovers(owner_id,id) on delete cascade,
  check (num_nonnulls(character_id,group_id)=1),
  check (num_nonnulls(universe_id,crossover_id)<=1)
);
create index on public.conversations (character_id);
create index on public.conversations (group_id);
create index on public.conversations (universe_id);
create index on public.conversations (crossover_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  role text not null default 'user' check (role in ('user', 'assistant')),
  body text not null check (length(body) between 1 and 24000),
  mentions uuid[] not null default '{}',
  attachment text not null default '',
  mime text not null default '',
  conversation_id uuid not null,
  character_id uuid,
  reply_to uuid,
  source_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,conversation_id) references public.conversations(owner_id,id) on delete cascade,
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  foreign key (owner_id,reply_to) references public.messages(owner_id,id) on delete cascade,
  foreign key (owner_id,source_id) references public.messages(owner_id,id) on delete cascade,
  unique(source_id, character_id),
  unique(owner_id,conversation_id,id),
  foreign key (owner_id,conversation_id,reply_to) references public.messages(owner_id,conversation_id,id) on delete cascade,
  foreign key (owner_id,conversation_id,source_id) references public.messages(owner_id,conversation_id,id) on delete cascade,
  check ((role='assistant')=(character_id is not null))
);
create index on public.messages (conversation_id);
create index on public.messages (character_id);
create index on public.messages (reply_to);
create index on public.messages (source_id);

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  emoji text not null check(length(emoji) between 1 and 20),
  message_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,message_id) references public.messages(owner_id,id) on delete cascade,
  unique(owner_id,message_id,emoji)
);
create index on public.message_reactions (message_id);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  scope text not null default 'user' check (scope in ('user', 'character', 'personal', 'group', 'social', 'universe', 'crossover')),
  body text not null check(length(trim(body)) between 1 and 6000),
  importance int not null default 5 check (importance between 1 and 10),
  character_id uuid,
  conversation_id uuid,
  group_id uuid,
  relationship_id uuid,
  universe_id uuid,
  crossover_id uuid,
  source_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  foreign key (owner_id,conversation_id) references public.conversations(owner_id,id) on delete cascade,
  foreign key (owner_id,group_id) references public.groups(owner_id,id) on delete cascade,
  foreign key (owner_id,relationship_id) references public.relationships(owner_id,id) on delete cascade,
  foreign key (owner_id,universe_id) references public.universes(owner_id,id) on delete cascade,
  foreign key (owner_id,crossover_id) references public.crossovers(owner_id,id) on delete cascade,
  foreign key (owner_id,source_id) references public.messages(owner_id,id) on delete cascade,
  check (num_nonnulls(character_id,conversation_id,group_id,relationship_id,universe_id,crossover_id) = case when scope='user' then 0 else 1 end),
  check (case scope when 'user' then true when 'character' then character_id is not null when 'personal' then conversation_id is not null when 'group' then group_id is not null when 'social' then relationship_id is not null when 'universe' then universe_id is not null when 'crossover' then crossover_id is not null end)
);
create index on public.memories (character_id);
create index on public.memories (conversation_id);
create index on public.memories (group_id);
create index on public.memories (relationship_id);
create index on public.memories (universe_id);
create index on public.memories (crossover_id);
create index on public.memories (source_id);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  caption text not null default '',
  media text not null default '',
  mime text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  audience text not null default 'private' check (audience in ('private', 'group', 'universe')),
  publish_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours'),
  character_id uuid not null,
  group_id uuid,
  universe_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  foreign key (owner_id,group_id) references public.groups(owner_id,id) on delete cascade,
  foreign key (owner_id,universe_id) references public.universes(owner_id,id) on delete cascade,
  check(expires_at > publish_at),
  check ((audience='group')=(group_id is not null) and (audience='universe')=(universe_id is not null))
);
create index on public.stories (character_id);
create index on public.stories (group_id);
create index on public.stories (universe_id);

create table public.story_activity (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  kind text not null default 'view' check (kind in ('view', 'like', 'reaction', 'reply')),
  body text not null default '',
  story_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,story_id) references public.stories(owner_id,id) on delete cascade
);
create index on public.story_activity (story_id);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  bucket text not null,
  path text not null,
  mime text not null default '',
  bytes bigint not null check(bytes>=0),
  character_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade,
  unique(bucket,path),
  check(split_part(path,'/',1)=owner_id::text)
);
create index on public.media_assets (character_id);

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  activity text not null default '',
  mood text not null default '',
  at_time time not null default '09:00',
  enabled boolean not null default true,
  last_run date,
  character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade
);
create index on public.schedules (character_id);

create table public.diaries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  body text not null default '',
  mood text not null default '',
  character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade
);
create index on public.diaries (character_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  body text not null default '',
  due_at timestamptz not null,
  executed_at timestamptz,
  character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade
);
create index on public.events (character_id);

create table public.settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  simulation boolean not null default false,
  notifications boolean not null default true,
  proactive boolean not null default false,
  quiet_start time not null default '22:00',
  quiet_end time not null default '07:00',
  timezone text not null default 'Asia/Jakarta',
  frequency_hours int not null default 24 check (frequency_hours between 1 and 720),
  language text not null default 'Indonesian',
  system_prompt text not null default '',
  memory_limit int not null default 12 check(memory_limit between 1 and 40),
  last_tick timestamptz,
  unique (owner_id,id),
  unique(owner_id)
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  adapter text not null default 'openrouter' check (adapter in ('openrouter', 'openai', 'compatible')),
  model text not null check(length(trim(model))>0),
  priority int not null default 1 check(priority between 1 and 50),
  enabled boolean not null default true,
  input_price numeric not null default 0 check(input_price>=0),
  output_price numeric not null default 0 check(output_price>=0),
  unique (owner_id,id)
);

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  operation text not null,
  model text not null default '',
  input_tokens int,
  output_tokens int,
  cost numeric,
  error text not null default '',
  provider_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,provider_id) references public.providers(owner_id,id) on delete cascade
);
create index on public.usage_logs (provider_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  body text not null default '',
  due_at timestamptz not null default now(),
  read_at timestamptz,
  sent_at timestamptz,
  conversation_id uuid,
  story_id uuid,
  unique (owner_id,id),
  foreign key (owner_id,conversation_id) references public.conversations(owner_id,id) on delete cascade,
  foreign key (owner_id,story_id) references public.stories(owner_id,id) on delete cascade
);
create index on public.notifications (conversation_id);
create index on public.notifications (story_id);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null check (length(trim(name)) between 1 and 180),
  token text not null unique,
  unique (owner_id,id)
);

create table public.calls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  state text not null default 'connecting' check (state in ('connecting', 'connected', 'ended', 'failed')),
  started_at timestamptz,
  ended_at timestamptz,
  character_id uuid not null,
  unique (owner_id,id),
  foreign key (owner_id,character_id) references public.characters(owner_id,id) on delete cascade
);
create index on public.calls (character_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  operation text not null,
  entity text not null,
  record_id uuid not null,
  unique (owner_id,id)
);

create unique index relationship_pair on public.relationships (owner_id,least(character_id,other_character_id),greatest(character_id,other_character_id));
create unique index story_once on public.story_activity (story_id,owner_id,kind) where kind in ('like','view');
create index message_history on public.messages (conversation_id,created_at desc,id);
create index memory_rank on public.memories (owner_id,scope,importance desc);
create index pending_notifications on public.notifications(due_at) where sent_at is null;

do $policies$
declare t text;
begin
  foreach t in array array['characters', 'universes', 'universe_characters', 'world_entries', 'crossovers', 'relationships', 'interactions', 'groups', 'group_members', 'conversations', 'messages', 'message_reactions', 'memories', 'stories', 'story_activity', 'media_assets', 'schedules', 'diaries', 'events', 'settings', 'providers', 'usage_logs', 'notifications', 'devices', 'calls', 'audit_logs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, public, authenticated',t);
    execute format('grant all on public.%I to service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy owner_read on public.%I for select to authenticated using(owner_id=(select auth.uid()) and (select public.is_myra_admin()))',t);
    if t not in ('audit_logs','usage_logs') then
      execute format('grant insert,update,delete on public.%I to authenticated',t);
      execute format('create policy owner_write on public.%I for all to authenticated using(owner_id=(select auth.uid()) and (select public.is_myra_admin())) with check(owner_id=(select auth.uid()) and (select public.is_myra_admin()))',t);
    end if;
  end loop;
end
$policies$;
grant all on public.admin_access to service_role;
