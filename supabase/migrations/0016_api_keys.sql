-- 0016_api_keys.sql
-- API key management and usage tracking for the public image generation API.
-- Users create keys in /dashboard/api; admins monitor usage in /admin/api.

-- ─────────────────────────────────────────────────────────────────────
-- api_keys — one row per user-issued API key
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.api_keys (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  name           text not null default 'Untitled key',
  key_hash       text not null unique,      -- SHA-256 of the full key
  key_prefix     text not null,             -- first 8 chars for display (ngn_xxxx)
  scopes         text[] not null default '{}', -- model slugs; empty = all
  rate_limit_rpm int  not null default 60,  -- requests per minute
  rate_limit_rpd int  not null default 1000,-- requests per day
  is_active      boolean not null default true,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz                -- null = never expires
);

-- Indexes for lookup performance
create index if not exists idx_api_keys_user    on public.api_keys(user_id);
create index if not exists idx_api_keys_hash    on public.api_keys(key_hash);
create index if not exists idx_api_keys_prefix  on public.api_keys(key_prefix);

-- ─────────────────────────────────────────────────────────────────────
-- api_usage_logs — per-request audit trail
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.api_usage_logs (
  id             uuid primary key default gen_random_uuid(),
  api_key_id     uuid not null references public.api_keys(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  model_slug     text,
  endpoint       text not null default '/v1/generate',
  status_code    int  not null default 200,
  latency_ms     int,
  ip_address     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_api_usage_key    on public.api_usage_logs(api_key_id);
create index if not exists idx_api_usage_user   on public.api_usage_logs(user_id);
create index if not exists idx_api_usage_date   on public.api_usage_logs(created_at);

-- ─────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────
alter table public.api_keys enable row level security;
alter table public.api_usage_logs enable row level security;

-- Users can manage their own keys
create policy "Users read own keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

create policy "Users insert own keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

create policy "Users update own keys"
  on public.api_keys for update
  using (auth.uid() = user_id);

create policy "Users delete own keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);

-- Admins can read all keys
create policy "Admins read all keys"
  on public.api_keys for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Users read own usage logs
create policy "Users read own usage"
  on public.api_usage_logs for select
  using (auth.uid() = user_id);

-- Admins read all usage logs
create policy "Admins read all usage"
  on public.api_usage_logs for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- Service role (admin client) can insert usage logs from API routes
-- (no user-facing insert policy needed — API routes use the admin client)
