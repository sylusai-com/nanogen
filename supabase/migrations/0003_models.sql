-- ============================================================================
-- 0003_models.sql
-- Replaces the hard-coded model catalog with a DB-driven registry that
-- admins can manage from the dashboard.
--
-- Two kinds of models:
--   image — image generation models (used by /api/generate)
--   text  — text generation models (used by /api/banners/html via OpenRouter)
--
-- API keys never live in this table — they stay in env vars, looked up by
-- provider name (e.g. provider='openrouter' → process.env.OPENROUTER_API_KEY).
-- The `config` jsonb column is for any extra per-model knobs.
-- ============================================================================

create table if not exists public.models (
  id          uuid primary key default uuid_generate_v4(),
  slug        text unique not null,
  label       text not null,
  kind        text not null check (kind in ('image', 'text')),
  provider    text not null,
  model_id    text not null,                -- provider-specific model identifier
  enabled     boolean not null default true,
  is_default  boolean not null default false, -- text models: marks the default for HTML gen
  sort_order  int not null default 0,
  preview_gradient text,                    -- image models: thumbnail gradient
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_models_kind on public.models(kind, enabled, sort_order);

-- ============================================================================
-- Trigger: at most one default per kind
-- ============================================================================
create or replace function public.enforce_single_default_model()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.models
       set is_default = false
     where kind = new.kind and id <> new.id;
  end if;
  return new;
end $$;

drop trigger if exists models_single_default on public.models;
create trigger models_single_default
  before insert or update of is_default on public.models
  for each row execute function public.enforce_single_default_model();

drop trigger if exists models_updated_at on public.models;
create trigger models_updated_at before update on public.models
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS: anyone (anon + authed) can read enabled rows; only admins can write
-- ============================================================================
alter table public.models enable row level security;

drop policy if exists "models_select_enabled" on public.models;
create policy "models_select_enabled" on public.models
  for select using (enabled);

drop policy if exists "models_admin_all" on public.models;
create policy "models_admin_all" on public.models
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Seed: replicate the previous hard-coded catalog so the app keeps working
-- on first run. Admins can edit/disable/delete from the dashboard.
-- ============================================================================
insert into public.models (slug, label, kind, provider, model_id, enabled, is_default, sort_order, preview_gradient)
values
  -- Image models
  ('sdxl',   'Stable Diffusion XL', 'image', 'replicate',  'stability-ai/sdxl',                 true,  false, 1, 'from-violet-500/40 via-fuchsia-500/20 to-indigo-700/40'),
  ('imagen', 'Imagen 3',            'image', 'google',     'imagen-3.0-generate-001',           true,  false, 2, 'from-cyan-400/30 via-violet-500/20 to-indigo-800/40'),
  ('flux',   'Flux Pro',            'image', 'replicate',  'black-forest-labs/flux-1.1-pro',    true,  false, 3, 'from-amber-300/20 via-pink-500/30 to-rose-700/40'),
  ('dalle',  'DALL·E 3',            'image', 'openai',     'dall-e-3',                          false, false, 4, 'from-emerald-400/30 via-cyan-400/20 to-teal-700/40'),
  -- Text models (used for HTML banner generation via OpenRouter)
  ('claude-sonnet-3-5',   'Claude Sonnet 3.5',   'text', 'openrouter', 'anthropic/claude-3.5-sonnet', true, true,  1, null),
  ('gpt-4o',              'GPT-4o',              'text', 'openrouter', 'openai/gpt-4o',                true, false, 2, null),
  ('gemini-2-flash',      'Gemini 2.0 Flash',    'text', 'openrouter', 'google/gemini-2.0-flash-001',  true, false, 3, null)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
