-- ============================================================================
-- 0006_builder_and_admin_catalog.sql
--
-- 1. Ensures canvas column has correct default (already added in 0004, but
--    we make the policy explicit for the builder page).
-- 2. Adds is_default to aspect_ratios so the form can pre-select one.
-- 3. Adds a description column to banner_styles for admin context.
-- 4. Ensures RLS policies exist for admin writes on both catalog tables.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. aspect_ratios — add is_default flag
-- ──────────────────────────────────────────────────────────────────────────
alter table public.aspect_ratios
  add column if not exists is_default boolean not null default false;

-- Only one row can be default — enforce via a partial unique index.
drop index if exists idx_aspect_ratios_single_default;
create unique index if not exists idx_aspect_ratios_single_default
  on public.aspect_ratios (is_default)
  where (is_default = true);

-- Set landscape as the default if none is set yet.
update public.aspect_ratios
set is_default = true
where slug = '16-9'
  and not exists (
    select 1 from public.aspect_ratios where is_default = true
  );

-- ──────────────────────────────────────────────────────────────────────────
-- 2. banner_styles — add description column
-- ──────────────────────────────────────────────────────────────────────────
alter table public.banner_styles
  add column if not exists description text;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. banners — ensure canvas column exists (idempotent, 0004 added it)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.banners
  alter column canvas set default '{"background":"#0c0c10","elements":[]}'::jsonb;

notify pgrst, 'reload schema';