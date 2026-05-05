-- ============================================================================
-- 0010_banner_reference_image.sql
-- Adds reference-image storage to the banner pipeline.
--
-- The user can upload a reference image at /dashboard/create. We:
--   1. Run it through a vision model on the server to extract context
--      (subject, palette, mood, composition) — that JSON is stored on
--      `generation_runs.reference_context` and on `banners.reference_context`.
--   2. Persist the (already-compressed) data: URL on `banners.reference_image_url`
--      and `generation_runs.reference_image_url` so the banner detail/edit
--      pages can show the user the reference they uploaded.
--
-- Reference values are user-supplied data: URIs (or http(s) for external
-- references). RLS for these tables is unchanged — the columns inherit the
-- existing per-row policies.
-- ============================================================================

alter table public.banners
  add column if not exists reference_image_url text,
  add column if not exists reference_context   jsonb;

alter table public.generation_runs
  add column if not exists reference_context   jsonb;

notify pgrst, 'reload schema';
