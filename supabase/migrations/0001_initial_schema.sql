-- ============================================================================
-- 0001_initial_schema.sql
-- Initial schema for Nanozen: profiles, generations, banners, RLS, triggers.
-- Apply by pasting into Supabase Dashboard → SQL editor → Run.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ============================================================================
-- profiles · mirrors auth.users with app-specific fields
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text,
  email       text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  plan        text not null default 'free' check (plan in ('free', 'pro')),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- admin_emails · pre-populate to auto-grant admin on signup
-- ============================================================================
create table if not exists public.admin_emails (
  email     text primary key,
  added_at  timestamptz not null default now()
);

-- ============================================================================
-- generation_runs · one row per /api/generate request
-- ============================================================================
create table if not exists public.generation_runs (
  id                   uuid primary key default uuid_generate_v4(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  prompt               text not null,
  aspect               text not null,
  style                text,
  models               text[] not null,
  reference_image_url  text,
  created_at           timestamptz not null default now()
);
create index if not exists idx_generation_runs_user
  on public.generation_runs(user_id, created_at desc);

-- ============================================================================
-- generation_results · per-model output within a run
-- ============================================================================
create table if not exists public.generation_results (
  id                uuid primary key default uuid_generate_v4(),
  run_id            uuid not null references public.generation_runs(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  model_id          text not null,
  model_label       text not null,
  provider          text,
  image_url         text,
  preview_gradient  text,
  score             int,
  latency_ms        int,
  is_winner         boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists idx_generation_results_run on public.generation_results(run_id);
create index if not exists idx_generation_results_user
  on public.generation_results(user_id, created_at desc);

-- ============================================================================
-- banners · a saved banner (the winner of a run, by default)
-- ============================================================================
create table if not exists public.banners (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  result_id         uuid references public.generation_results(id) on delete set null,
  title             text not null,
  prompt            text,
  style             text,
  aspect            text,
  model_id          text,
  model_label       text,
  image_url         text,
  preview_gradient  text,
  score             int,
  html              text,
  css               text,
  fields            jsonb,
  alignment         text default 'left',
  favourite         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_banners_user on public.banners(user_id, created_at desc);

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists banners_updated_at on public.banners;
create trigger banners_updated_at before update on public.banners
  for each row execute function public.set_updated_at();

-- ============================================================================
-- handle_new_user · auto-create profile when an auth user signs up.
-- Promotes to admin if email is in public.admin_emails.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_email boolean;
begin
  select exists(select 1 from public.admin_emails where email = new.email)
    into is_admin_email;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when is_admin_email then 'admin' else 'user' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- is_admin() · helper used by RLS policies. SECURITY DEFINER avoids the
-- recursion that would otherwise happen when a profiles policy queries profiles.
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.profiles            enable row level security;
alter table public.admin_emails        enable row level security;
alter table public.generation_runs     enable row level security;
alter table public.generation_results  enable row level security;
alter table public.banners             enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- inserts handled by the security-definer trigger; no insert policy needed

-- admin_emails (admins only)
drop policy if exists "admin_emails_all" on public.admin_emails;
create policy "admin_emails_all" on public.admin_emails
  for all using (public.is_admin()) with check (public.is_admin());

-- generation_runs
drop policy if exists "runs_select" on public.generation_runs;
create policy "runs_select" on public.generation_runs
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "runs_insert_own" on public.generation_runs;
create policy "runs_insert_own" on public.generation_runs
  for insert with check (auth.uid() = user_id);

drop policy if exists "runs_delete_own" on public.generation_runs;
create policy "runs_delete_own" on public.generation_runs
  for delete using (auth.uid() = user_id);

-- generation_results
drop policy if exists "results_select" on public.generation_results;
create policy "results_select" on public.generation_results
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "results_insert_own" on public.generation_results;
create policy "results_insert_own" on public.generation_results
  for insert with check (auth.uid() = user_id);

-- banners
drop policy if exists "banners_select" on public.banners;
create policy "banners_select" on public.banners
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "banners_insert_own" on public.banners;
create policy "banners_insert_own" on public.banners
  for insert with check (auth.uid() = user_id);

drop policy if exists "banners_update_own" on public.banners;
create policy "banners_update_own" on public.banners
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "banners_delete_own" on public.banners;
create policy "banners_delete_own" on public.banners
  for delete using (auth.uid() = user_id);
