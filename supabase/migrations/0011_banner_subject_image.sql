-- ============================================================================
-- 0011_banner_subject_image.sql
-- Adds subject-image storage to the banner pipeline.
--
-- The reference image (added in 0010) inspires the banner — palette, mood,
-- motifs — but is never embedded. The SUBJECT image is different: it is
-- the asset the user wants visible IN the rendered banner (a person,
-- product photo, logo, etc). The pipeline:
--   1. The application receives the subject data: URI from /dashboard/create.
--   2. A vision model classifies the subject and produces placement /
--      treatment guidance — that JSON is stored on
--      `generation_runs.subject_context` and `banners.subject_context`.
--   3. The original subject URL is persisted on
--      `generation_runs.subject_image_url` and `banners.subject_image_url`
--      so the banner detail/edit pages and the regenerate flow can carry
--      it forward when the user iterates on the design.
--
-- RLS is unchanged — the new columns inherit existing per-row policies.
-- ============================================================================

alter table public.banners
  add column if not exists subject_image_url text,
  add column if not exists subject_context   jsonb;

alter table public.generation_runs
  add column if not exists subject_image_url text,
  add column if not exists subject_context   jsonb;

notify pgrst, 'reload schema';
