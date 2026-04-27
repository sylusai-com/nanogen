-- supabase/migrations/0004_canvas_and_catalog.sql
-- ============================================================================
-- 0004_canvas_and_catalog.sql
--
-- Phase 3 update — three things in one migration:
--
--  1. Adds a `canvas` jsonb column to banners for the drag-and-drop builder.
--     Shape: { "background": "#0c0c10", "elements": [ ... ] }
--
--  2. Moves the previously hard-coded ASPECT_RATIOS array into a
--     `public.aspect_ratios` table that admins can manage.
--
--  3. Moves the previously hard-coded STYLES list (and the per-style color
--     presets used by the HTML banner generator) into a `public.banner_styles`
--     table that admins can manage.
-- ============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Builder canvas column
-- ──────────────────────────────────────────────────────────────────────────
alter table public.banners
  add column if not exists canvas jsonb
  not null
  default '{"background":"#0c0c10","elements":[]}'::jsonb;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Aspect ratios catalog
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.aspect_ratios (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  label       text not null,
  ratio       text not null,             -- e.g. '16:9'
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_aspect_ratios_enabled
  on public.aspect_ratios(enabled, sort_order);

drop trigger if exists aspect_ratios_updated_at on public.aspect_ratios;
create trigger aspect_ratios_updated_at before update on public.aspect_ratios
  for each row execute function public.set_updated_at();

alter table public.aspect_ratios enable row level security;

drop policy if exists "aspect_ratios_select_enabled" on public.aspect_ratios;
create policy "aspect_ratios_select_enabled" on public.aspect_ratios
  for select using (enabled);

drop policy if exists "aspect_ratios_admin_all" on public.aspect_ratios;
create policy "aspect_ratios_admin_all" on public.aspect_ratios
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.aspect_ratios (slug, label, ratio, sort_order) values
  ('16-9', 'Landscape · 16:9', '16:9', 1),
  ('1-1',  'Square · 1:1',     '1:1',  2),
  ('4-5',  'Portrait · 4:5',   '4:5',  3),
  ('9-16', 'Story · 9:16',     '9:16', 4)
on conflict (slug) do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Banner styles catalog
--
-- Each row drives both the prompt-form Style chip group AND the color
-- preset that the HTML banner generator applies. The `gradient` column is
-- used for thumbnail placeholders.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.banner_styles (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  label       text not null,
  bg          text not null,             -- background color
  fg          text not null,             -- foreground/text color
  accent      text not null,             -- accent color
  gradient    text,                      -- thumbnail gradient (CSS value)
  enabled     boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_banner_styles_enabled
  on public.banner_styles(enabled, sort_order);

drop trigger if exists banner_styles_updated_at on public.banner_styles;
create trigger banner_styles_updated_at before update on public.banner_styles
  for each row execute function public.set_updated_at();

alter table public.banner_styles enable row level security;

drop policy if exists "banner_styles_select_enabled" on public.banner_styles;
create policy "banner_styles_select_enabled" on public.banner_styles
  for select using (enabled);

drop policy if exists "banner_styles_admin_all" on public.banner_styles;
create policy "banner_styles_admin_all" on public.banner_styles
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.banner_styles (slug, label, bg, fg, accent, gradient, sort_order) values
  ('modern',    'Modern',    '#0c0c10', '#ffffff', '#a78bfa', 'linear-gradient(135deg, #4c1d95 0%, #1e1b4b 50%, #082f49 100%)', 1),
  ('minimal',   'Minimal',   '#fafafa', '#0a0a0b', '#7c3aed', 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #3f3f46 100%)', 2),
  ('cyberpunk', 'Cyberpunk', '#0a0019', '#fff7ff', '#ec4899', 'linear-gradient(135deg, #0a0019 0%, #4c1d95 50%, #ec4899 100%)', 3),
  ('editorial', 'Editorial', '#0a0e1f', '#fff8e7', '#f59e0b', 'linear-gradient(135deg, #0a0e1f 0%, #1e293b 50%, #082f49 100%)', 4),
  ('playful',   'Playful',   '#1a0033', '#fff7ff', '#22d3ee', 'linear-gradient(135deg, #831843 0%, #be185d 50%, #f59e0b 100%)', 5),
  ('corporate', 'Corporate', '#0b1220', '#f8fafc', '#3b82f6', 'linear-gradient(135deg, #0b1220 0%, #1e3a8a 50%, #1e40af 100%)', 6)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
