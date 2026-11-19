insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
select b,b,false,case when b='character-avatars' then 10485760 else 52428800 end,
  case when b in ('character-avatars','universe-covers','character-gallery') then array['image/jpeg','image/png','image/webp','image/gif']
       when b='voice-media' then array['audio/mpeg','audio/webm','audio/ogg','audio/wav','audio/mp4']
       else array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/webm','audio/ogg','audio/mp4','audio/wav'] end
from unnest(array['character-avatars','character-gallery','stories','conversation-media','voice-media','universe-covers']) b;
create policy myra_private_media on storage.objects for all to authenticated
using (bucket_id in ('character-avatars','character-gallery','stories','conversation-media','voice-media','universe-covers')
 and split_part(name,'/',1)=(select auth.uid())::text and (select public.is_myra_admin()))
with check (bucket_id in ('character-avatars','character-gallery','stories','conversation-media','voice-media','universe-covers')
 and split_part(name,'/',1)=(select auth.uid())::text and (select public.is_myra_admin()));
do $$ declare t text; begin
  foreach t in array array['characters','universes','groups','group_members','conversations','messages','message_reactions','memories','stories','story_activity','notifications','diaries','relationships','interactions'] loop
    if not exists(select from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;
