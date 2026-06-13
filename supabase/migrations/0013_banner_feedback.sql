-- ============================================================================
-- 0013_banner_feedback.sql
-- Add feedback columns to the banners table
-- ============================================================================

alter table public.banners
  add column if not exists feedback_rating text check (feedback_rating in ('good', 'bad')),
  add column if not exists feedback_text text;
