begin;

create table if not exists public.subscription_profiles (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null default 'default',
  name text not null,
  normalized_name text not null,
  billing_cycle text not null default 'monthly',
  expected_amount numeric,
  amount_tolerance numeric not null default 2,
  expected_day_of_month smallint,
  provider_hint text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subscription_profiles_billing_cycle_check
    check (billing_cycle in ('monthly', 'quarterly', 'yearly')),
  constraint subscription_profiles_amount_tolerance_check
    check (amount_tolerance >= 0),
  constraint subscription_profiles_expected_day_of_month_check
    check (expected_day_of_month is null or (expected_day_of_month between 1 and 31)),
  constraint subscription_profiles_provider_hint_check
    check (provider_hint is null or provider_hint in ('paypal', 'google_play', 'apple', 'klarna', 'other')),
  constraint subscription_profiles_plan_name_unique
    unique (plan_key, normalized_name)
);

create index if not exists subscription_profiles_plan_is_active_idx
  on public.subscription_profiles(plan_key, is_active);

create table if not exists public.subscription_profile_rules (
  id uuid primary key default gen_random_uuid(),
  subscription_profile_id uuid not null
    references public.subscription_profiles(id)
    on delete cascade,
  pattern text not null,
  pattern_normalized text not null,
  pattern_type text not null,
  weight integer not null default 50,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint subscription_profile_rules_pattern_type_check
    check (pattern_type in ('counterparty_contains', 'details_contains')),
  constraint subscription_profile_rules_weight_check
    check (weight between 1 and 100),
  constraint subscription_profile_rules_unique_pattern
    unique (subscription_profile_id, pattern_normalized, pattern_type)
);

create index if not exists subscription_profile_rules_pattern_idx
  on public.subscription_profile_rules(pattern_normalized, pattern_type, is_active);

create table if not exists public.transaction_subscription_matches (
  transaction_id uuid primary key
    references public.transactions(id)
    on delete cascade,
  subscription_profile_id uuid
    references public.subscription_profiles(id)
    on delete set null,
  match_source text not null,
  confidence numeric,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint transaction_subscription_matches_source_check
    check (match_source in ('manual', 'rule', 'heuristic', 'ignored')),
  constraint transaction_subscription_matches_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists transaction_subscription_matches_profile_idx
  on public.transaction_subscription_matches(subscription_profile_id);

create index if not exists transaction_subscription_matches_source_idx
  on public.transaction_subscription_matches(match_source);

commit;
