begin;

create table if not exists public.forecast_timeline_events (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  event_key text not null,
  event_date date not null,
  event_type text not null,
  label text not null,
  amount numeric not null default 0,
  source text not null,
  confidence text not null default 'medium',
  fingerprint text not null,
  reference_transaction_id uuid null references public.transactions(id) on delete set null,
  reference_category_id uuid null references public.categories(id) on delete set null,
  reference_category_path text null,
  reference_label text null,
  reference_source_type text null,
  computed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint forecast_timeline_events_event_type_check
    check (event_type in ('income', 'fixed_cost', 'subscription', 'savings_transfer', 'milestone_lowest_balance')),
  constraint forecast_timeline_events_source_check
    check (source in ('income_source', 'recurring_history', 'subscription_profile', 'rare_subscription', 'derived')),
  constraint forecast_timeline_events_confidence_check
    check (confidence in ('medium', 'high')),
  constraint forecast_timeline_events_reference_source_type_check
    check (
      reference_source_type is null or reference_source_type in (
        'transaction',
        'income_source',
        'subscription_profile',
        'rare_subscription',
        'derived'
      )
    ),
  constraint forecast_timeline_events_user_month_event_unique
    unique (user_id, month_start, event_key)
);

alter table public.forecast_timeline_events
  add column if not exists reference_transaction_id uuid null references public.transactions(id) on delete set null,
  add column if not exists reference_category_id uuid null references public.categories(id) on delete set null,
  add column if not exists reference_category_path text null,
  add column if not exists reference_label text null,
  add column if not exists reference_source_type text null;

create index if not exists forecast_timeline_events_user_month_date_idx
  on public.forecast_timeline_events(user_id, month_start, event_date);

create index if not exists forecast_timeline_events_user_month_type_idx
  on public.forecast_timeline_events(user_id, month_start, event_type);

alter table public.forecast_timeline_events
  alter column user_id set default auth.uid();

alter table public.forecast_timeline_events enable row level security;

drop policy if exists forecast_timeline_events_owner_policy on public.forecast_timeline_events;
create policy forecast_timeline_events_owner_policy
  on public.forecast_timeline_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
