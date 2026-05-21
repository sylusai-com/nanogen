-- ============================================================================
-- 0015_model_credit_status.sql
-- Per-model credit health, surfaced on /admin/models.
--
-- When a banner generation fails because the model provider's account is out
-- of credits (e.g. OpenRouter: "This request requires more credits, or fewer
-- max_tokens…"), the generation pipeline records it on the model row. The
-- admin model registry then shows an "out of credits" alert on the affected
-- model so the team can top up or switch the default model — instead of
-- users silently receiving fallback banners with no idea why.
--
--   credit_status     'ok' | 'insufficient' | null (never observed)
--   credit_detail     the upstream error message, for the admin to read
--   credit_checked_at when the status was last written
--
-- Best-effort telemetry: the pipeline never blocks on these writes, and
-- works fine BEFORE this migration is applied (the writes simply no-op and
-- the admin UI shows nothing). RLS is unchanged — the new columns inherit
-- the existing per-row models policies.
-- ============================================================================

alter table public.models
  add column if not exists credit_status     text,
  add column if not exists credit_detail     text,
  add column if not exists credit_checked_at timestamptz;

notify pgrst, 'reload schema';
