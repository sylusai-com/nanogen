-- 0014_banner_images_bucket.sql
--
-- Creates the `banner-images` storage bucket used by the banner-generation
-- pipeline to persist reference / subject / AI-generated background images.
--
-- The server has a runtime auto-create path (see lib/server/bannerImageStorage.js
-- — ensureBucket), but that path needs the service-role key to be allowed to
-- create buckets, and it fails silently on hosted Supabase projects whose
-- storage policies block bucket creation from outside the dashboard. When it
-- fails the pipeline falls back to embedding data URIs in the banner row,
-- which works but bloats rows and slows dashboard listings.
--
-- Running this migration once is the durable fix. Idempotent — safe to apply
-- on existing projects.

-- 1. The bucket itself. Public so signed banners can be embedded by their
--    public URL without per-row signing logic.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'banner-images',
  'banner-images',
  true,
  10485760,                                          -- 10 MB cap per image
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 2. Public read policy. The bucket is `public = true`, but storage.objects
--    still needs an explicit RLS policy to permit anonymous reads (Supabase
--    keeps RLS on by default).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'banner_images_public_read'
  ) then
    create policy banner_images_public_read
      on storage.objects
      for select
      to public
      using (bucket_id = 'banner-images');
  end if;
end $$;

-- 3. Authenticated-write policy. Lets signed-in users upload via the server
--    when the server-side admin client isn't available (e.g. local dev with
--    only the publishable key). The service role bypasses RLS so this does
--    not change behavior when the secret key IS configured.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'banner_images_authenticated_write'
  ) then
    create policy banner_images_authenticated_write
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'banner-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'banner_images_authenticated_update'
  ) then
    create policy banner_images_authenticated_update
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'banner-images')
      with check (bucket_id = 'banner-images');
  end if;
end $$;
