-- ============================================================================
-- 0007_banners_run_id.sql
--
-- Adds run_id to banners so all variants generated from a single prompt can
-- be grouped together in the dashboard.
-- ============================================================================

alter table public.banners
  add column if not exists run_id uuid references public.generation_runs(id) on delete set null;

create index if not exists idx_banners_run_id
  on public.banners(run_id);

notify pgrst, 'reload schema';
