create table if not exists public.forecast_refresh_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_dirty boolean not null default true,
  dirty_at timestamptz,
  last_computed_at timestamptz,
  last_reason text,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists forecast_refresh_state_dirty_idx
  on public.forecast_refresh_state(is_dirty, updated_at desc);

alter table public.forecast_refresh_state enable row level security;

drop policy if exists forecast_refresh_state_owner_policy on public.forecast_refresh_state;
create policy forecast_refresh_state_owner_policy
  on public.forecast_refresh_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
