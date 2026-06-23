-- ============================================================================
-- 0018_credits_system.sql
-- Credit/token system for banner generation
-- ============================================================================

-- 1. Tables

create table if not exists public.credit_plans (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  slug        text not null unique,
  credits     int not null default 5, -- -1 means unlimited
  description text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.user_credits (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  plan_id         uuid references public.credit_plans(id) on delete set null,
  credits_remaining int not null default 5,
  credits_used    int not null default 0,
  period_start    timestamptz not null default date_trunc('month', now()),
  period_end      timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  updated_at      timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      int not null,
  reason      text not null, -- 'generation', 'admin_adjustment', 'plan_change', 'monthly_reset'
  banner_id   uuid references public.banners(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 2. RLS Policies

alter table public.credit_plans enable row level security;
alter table public.user_credits enable row level security;
alter table public.credit_transactions enable row level security;

-- credit_plans: anyone can read (for UI presentation), admins can write
create policy "plans_select_all" on public.credit_plans for select using (true);
create policy "plans_insert_admin" on public.credit_plans for insert with check (public.is_admin());
create policy "plans_update_admin" on public.credit_plans for update using (public.is_admin()) with check (public.is_admin());
create policy "plans_delete_admin" on public.credit_plans for delete using (public.is_admin());

-- user_credits: user can read own, admins can read/write all
create policy "user_credits_select_own" on public.user_credits for select using (auth.uid() = user_id or public.is_admin());
create policy "user_credits_insert_admin" on public.user_credits for insert with check (public.is_admin());
create policy "user_credits_update_admin" on public.user_credits for update using (public.is_admin()) with check (public.is_admin());
create policy "user_credits_delete_admin" on public.user_credits for delete using (public.is_admin());

-- credit_transactions: user can read own, admins can read all
create policy "tx_select_own" on public.credit_transactions for select using (auth.uid() = user_id or public.is_admin());
create policy "tx_insert_own" on public.credit_transactions for insert with check (auth.uid() = user_id or public.is_admin());

-- 3. Functions & Triggers

create trigger credit_plans_updated_at before update on public.credit_plans
  for each row execute function public.set_updated_at();

create trigger user_credits_updated_at before update on public.user_credits
  for each row execute function public.set_updated_at();

-- Seed Default Plans
insert into public.credit_plans (name, slug, credits, description, is_default)
values
  ('Free', 'free', 5, 'Basic access for individuals to try Nanozen', true),
  ('Pro', 'pro', 100, 'For power users and small teams', false),
  ('Enterprise', 'enterprise', -1, 'Unlimited access', false)
on conflict (slug) do nothing;

-- Function: deduct_credit (Atomic decrement)
-- Used securely by the server. Bypasses RLS to guarantee consistency.
create or replace function public.deduct_credit(p_user_id uuid, p_banner_id uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
  v_is_admin boolean;
begin
  -- Check if user is admin (unlimited)
  select exists (select 1 from public.profiles where id = p_user_id and role = 'admin') into v_is_admin;
  if v_is_admin then
    return json_build_object('success', true, 'remaining', -1, 'is_admin', true);
  end if;

  -- Atomic update
  update public.user_credits
  set 
    credits_remaining = credits_remaining - 1,
    credits_used = credits_used + 1,
    updated_at = now()
  where user_id = p_user_id and credits_remaining > 0
  returning credits_remaining into v_remaining;

  if v_remaining is null then
    -- It could be unlimited (-1) or actually out of credits. Let's check unlimited.
    select credits_remaining into v_remaining from public.user_credits where user_id = p_user_id;
    if v_remaining = -1 then
      return json_build_object('success', true, 'remaining', -1);
    end if;
    return json_build_object('success', false, 'remaining', coalesce(v_remaining, 0));
  end if;

  -- Log transaction
  insert into public.credit_transactions (user_id, amount, reason, banner_id)
  values (p_user_id, -1, 'generation', p_banner_id);

  return json_build_object('success', true, 'remaining', v_remaining);
end;
$$;

-- Function: handle_new_user_credits
-- Hook into user creation to grant default credits
create or replace function public.grant_default_credits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_default_plan uuid;
  v_default_credits int;
begin
  select id, credits into v_default_plan, v_default_credits 
  from public.credit_plans 
  where is_default = true limit 1;

  if v_default_plan is not null then
    insert into public.user_credits (user_id, plan_id, credits_remaining)
    values (new.id, v_default_plan, v_default_credits);
  else
    insert into public.user_credits (user_id, credits_remaining)
    values (new.id, 5);
  end if;

  return new;
end;
$$;

-- Trigger this *after* the existing handle_new_user so profile exists
drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.grant_default_credits();

-- Grant to existing users manually if they don't have credits
insert into public.user_credits (user_id, plan_id, credits_remaining)
select p.id, cp.id, cp.credits
from public.profiles p
cross join (select id, credits from public.credit_plans where is_default = true limit 1) cp
left join public.user_credits uc on p.id = uc.user_id
where uc.user_id is null;

notify pgrst, 'reload schema';
