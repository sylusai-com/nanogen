-- ============================================================================
-- 0012_profiles_api_access.sql
-- Add api_access_allowed to profiles to lock down API key generation
-- ============================================================================

alter table public.profiles
  add column if not exists api_access_allowed boolean not null default false;
