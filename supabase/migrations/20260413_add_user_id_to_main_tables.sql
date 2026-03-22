-- Migration: prepare core tables for pooled multi-tenant ownership

begin;
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  account_type text not null,
  account_subtype text,
  provider text,
  currency text not null default 'EUR',
  account_masked text,
  account_hash text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint bank_accounts_account_type_check
    check (
      account_type in (
        'checking',
        'savings',
        'credit',
        'loan',
        'investment',
        'cash',
        'other'
      )
    ),
  constraint bank_accounts_currency_length_check
    check (char_length(currency) between 3 and 8)
);
create index if not exists bank_accounts_user_id_idx
  on public.bank_accounts(user_id);
create index if not exists bank_accounts_type_idx
  on public.bank_accounts(account_type);
create index if not exists bank_accounts_provider_idx
  on public.bank_accounts(provider);
create unique index if not exists bank_accounts_user_account_hash_unique
  on public.bank_accounts(user_id, account_hash)
  where account_hash is not null;
alter table public.bank_accounts
  drop constraint if exists bank_accounts_id_user_unique;
alter table public.bank_accounts
  add constraint bank_accounts_id_user_unique
  unique (id, user_id);
alter table public.transactions
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists bank_account_id uuid references public.bank_accounts(id) on delete restrict;
create index if not exists transactions_user_id_idx
  on public.transactions(user_id);
create index if not exists transactions_bank_account_id_idx
  on public.transactions(bank_account_id);
create index if not exists transactions_user_account_date_idx
  on public.transactions(user_id, bank_account_id, date desc);
drop index if exists public.transactions_unique;
create unique index if not exists transactions_user_account_dedupe_unique
  on public.transactions(user_id, bank_account_id, date, amount, details)
  where user_id is not null and bank_account_id is not null;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_bank_account_owner_fk'
  ) then
    alter table public.transactions
      add constraint transactions_bank_account_owner_fk
      foreign key (bank_account_id, user_id)
      references public.bank_accounts(id, user_id)
      on delete restrict;
  end if;
end $$;
alter table public.categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists categories_user_id_idx
  on public.categories(user_id);
alter table public.categorization_audit
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists categorization_audit_user_id_idx
  on public.categorization_audit(user_id);
create index if not exists categorization_audit_user_created_idx
  on public.categorization_audit(user_id, created_at desc);
alter table public.category_rules
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists scope text;
update public.category_rules
set scope = case
  when coalesce(is_system, false) then 'system'
  else 'user'
end
where scope is null;
-- Legacy rows can have non-system rules without owner yet; keep them valid
-- until explicit ownership backfill assigns user_id and scope.
update public.category_rules
set scope = 'system'
where scope = 'user'
  and user_id is null;
alter table public.category_rules
  alter column scope set default 'system';
alter table public.category_rules
  drop constraint if exists category_rules_pattern_normalized_pattern_type_key;
alter table public.category_rules
  drop constraint if exists category_rules_scope_check;
alter table public.category_rules
  drop constraint if exists category_rules_user_scope_check;
alter table public.category_rules
  add constraint category_rules_scope_check
  check (scope in ('system', 'user', 'global_learned'));
alter table public.category_rules
  add constraint category_rules_user_scope_check
  check (scope <> 'user' or user_id is not null);
create index if not exists category_rules_scope_idx
  on public.category_rules(scope);
create index if not exists category_rules_user_id_idx
  on public.category_rules(user_id);
create unique index if not exists category_rules_global_scope_unique
  on public.category_rules(scope, pattern_normalized, pattern_type)
  where scope in ('system', 'global_learned') and user_id is null;
create unique index if not exists category_rules_user_scope_unique
  on public.category_rules(user_id, pattern_normalized, pattern_type)
  where scope = 'user' and user_id is not null;
alter table public.forecast_income_sources
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists forecast_income_sources_user_id_idx
  on public.forecast_income_sources(user_id);
alter table public.forecast_income_sources
  drop constraint if exists forecast_income_sources_source_key_key;
alter table public.forecast_income_sources
  drop constraint if exists forecast_income_sources_user_source_unique;
alter table public.forecast_income_sources
  add constraint forecast_income_sources_user_source_unique
  unique (user_id, source_key);
alter table public.monthly_cashflow_forecasts
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists monthly_cashflow_forecasts_user_id_idx
  on public.monthly_cashflow_forecasts(user_id);
alter table public.monthly_cashflow_forecasts
  drop constraint if exists monthly_cashflow_forecasts_month_start_key;
alter table public.monthly_cashflow_forecasts
  drop constraint if exists monthly_cashflow_forecasts_user_month_unique;
alter table public.monthly_cashflow_forecasts
  add constraint monthly_cashflow_forecasts_user_month_unique
  unique (user_id, month_start);
create index if not exists monthly_cashflow_forecasts_user_month_idx
  on public.monthly_cashflow_forecasts(user_id, month_start);
alter table public.budget_category_overrides
  drop constraint if exists budget_category_overrides_plan_fk;
alter table public.monthly_budget_values
  drop constraint if exists monthly_budget_values_plan_fk;
alter table public.budget_plan_settings
  drop constraint if exists budget_plan_settings_pkey;
alter table public.budget_plan_settings
  drop constraint if exists budget_plan_settings_user_plan_unique;
alter table public.budget_plan_settings
  add column if not exists id uuid,
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
update public.budget_plan_settings
set id = gen_random_uuid()
where id is null;
alter table public.budget_plan_settings
  alter column id set default gen_random_uuid();
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budget_plan_settings'
      and column_name = 'id'
  ) then
    execute 'alter table public.budget_plan_settings alter column id set not null';
  end if;
end $$;
alter table public.budget_plan_settings
  add constraint budget_plan_settings_pkey primary key (id);
alter table public.budget_plan_settings
  add constraint budget_plan_settings_user_plan_unique
  unique (user_id, plan_key);
create index if not exists budget_plan_settings_user_id_idx
  on public.budget_plan_settings(user_id);
alter table public.budget_category_overrides
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists budget_category_overrides_user_id_idx
  on public.budget_category_overrides(user_id);
alter table public.budget_category_overrides
  drop constraint if exists budget_category_overrides_plan_category_unique;
alter table public.budget_category_overrides
  add constraint budget_category_overrides_user_plan_category_unique
  unique (user_id, plan_key, category_key);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'budget_category_overrides_user_plan_fk'
  ) then
    alter table public.budget_category_overrides
      add constraint budget_category_overrides_user_plan_fk
      foreign key (user_id, plan_key)
      references public.budget_plan_settings(user_id, plan_key)
      on delete cascade;
  end if;
end $$;
alter table public.monthly_budget_values
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists monthly_budget_values_user_id_idx
  on public.monthly_budget_values(user_id);
alter table public.monthly_budget_values
  drop constraint if exists monthly_budget_values_plan_month_category_unique;
alter table public.monthly_budget_values
  add constraint monthly_budget_values_user_plan_month_category_unique
  unique (user_id, plan_key, month_start, category_key);
create index if not exists monthly_budget_values_user_plan_month_idx
  on public.monthly_budget_values(user_id, plan_key, month_start);
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'monthly_budget_values_user_plan_fk'
  ) then
    alter table public.monthly_budget_values
      add constraint monthly_budget_values_user_plan_fk
      foreign key (user_id, plan_key)
      references public.budget_plan_settings(user_id, plan_key)
      on delete cascade;
  end if;
end $$;
alter table public.subscription_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists subscription_profiles_user_id_idx
  on public.subscription_profiles(user_id);
alter table public.subscription_profiles
  drop constraint if exists subscription_profiles_plan_name_unique;
alter table public.subscription_profiles
  add constraint subscription_profiles_user_plan_name_unique
  unique (user_id, plan_key, normalized_name);
create index if not exists subscription_profiles_user_plan_is_active_idx
  on public.subscription_profiles(user_id, plan_key, is_active);
alter table public.subscription_profile_rules
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists subscription_profile_rules_user_id_idx
  on public.subscription_profile_rules(user_id);
alter table public.transaction_subscription_matches
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists transaction_subscription_matches_user_id_idx
  on public.transaction_subscription_matches(user_id);
commit;
