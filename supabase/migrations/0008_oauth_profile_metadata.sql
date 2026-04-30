-- ============================================================================
-- 0008_oauth_profile_metadata.sql
--
-- Improves handle_new_user() so first-time sign-ins via Google (and any
-- other OAuth provider) populate `profiles.name` and `profiles.avatar_url`
-- from the provider's id_token claims.
--
-- Background: Supabase stores the OIDC userinfo claims under
-- auth.users.raw_user_meta_data. For Google that JSON looks like:
--   {
--     "iss":            "https://accounts.google.com",
--     "sub":            "...",
--     "name":           "Aman Bhatt",
--     "full_name":      "Aman Bhatt",
--     "given_name":     "Aman",
--     "family_name":    "Bhatt",
--     "picture":        "https://lh3.googleusercontent.com/...",
--     "avatar_url":     "https://lh3.googleusercontent.com/...",
--     "email":          "you@gmail.com",
--     "email_verified": true,
--     "provider_id":    "..."
--   }
-- The previous trigger only read `name`. This migration extends it to
-- check `full_name` first (the canonical Google field) and to capture
-- the avatar URL so the dashboard avatar uses the user's Google photo
-- instead of the generated initials placeholder.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_email boolean;
  meta           jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  resolved_name  text;
  resolved_avatar text;
begin
  select exists(select 1 from public.admin_emails where email = new.email)
    into is_admin_email;

  -- Pull the most informative name available from any OIDC provider.
  resolved_name := coalesce(
    nullif(meta->>'full_name', ''),
    nullif(meta->>'name', ''),
    nullif(meta->>'user_name', ''),
    split_part(new.email, '@', 1)
  );

  resolved_avatar := coalesce(
    nullif(meta->>'avatar_url', ''),
    nullif(meta->>'picture', '')
  );

  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    resolved_name,
    resolved_avatar,
    case when is_admin_email then 'admin' else 'user' end
  )
  on conflict (id) do update
    set name       = coalesce(excluded.name,       public.profiles.name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        email      = coalesce(excluded.email,      public.profiles.email);

  return new;
end $$;
