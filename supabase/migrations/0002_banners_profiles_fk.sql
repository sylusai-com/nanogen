-- ============================================================================
-- 0002_banners_profiles_fk.sql
-- Re-points the user_id foreign keys on banners, generation_runs, and
-- generation_results from auth.users → public.profiles.
--
-- Why: PostgREST embeds (e.g. `select(profiles(name, email))` from banners)
-- need a direct foreign key between the two tables. The original schema
-- pointed at auth.users, which works for cascade-delete but not for embeds.
--
-- profiles.id still references auth.users(id) with on delete cascade, so the
-- end-to-end delete chain is preserved:
--   auth.users deleted → profiles deleted → banners/runs/results deleted.
-- ============================================================================

alter table public.banners
  drop constraint if exists banners_user_id_fkey;

alter table public.banners
  add constraint banners_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.generation_runs
  drop constraint if exists generation_runs_user_id_fkey;

alter table public.generation_runs
  add constraint generation_runs_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

alter table public.generation_results
  drop constraint if exists generation_results_user_id_fkey;

alter table public.generation_results
  add constraint generation_results_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

-- Tell PostgREST to refresh its schema cache so the new relationship is
-- available immediately (otherwise the embed errors persist for ~10 minutes).
notify pgrst, 'reload schema';
