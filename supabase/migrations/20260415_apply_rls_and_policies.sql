-- Phase 3: enable RLS with strict tenant isolation policies.

begin;

-- ---------------------------------------------------------------------------
-- Ownership defaults to reduce breakage while phase 4 code-scoping is in
-- progress. Authenticated client inserts inherit auth.uid() automatically.
-- ---------------------------------------------------------------------------
alter table public.bank_accounts
  alter column user_id set default auth.uid();
alter table public.transactions
  alter column user_id set default auth.uid();
alter table public.categorization_audit
  alter column user_id set default auth.uid();
alter table public.budget_plan_settings
  alter column user_id set default auth.uid();
alter table public.budget_category_overrides
  alter column user_id set default auth.uid();
alter table public.monthly_budget_values
  alter column user_id set default auth.uid();
alter table public.forecast_income_sources
  alter column user_id set default auth.uid();
alter table public.monthly_cashflow_forecasts
  alter column user_id set default auth.uid();
alter table public.subscription_profiles
  alter column user_id set default auth.uid();
alter table public.subscription_profile_rules
  alter column user_id set default auth.uid();
alter table public.transaction_subscription_matches
  alter column user_id set default auth.uid();
alter table public.category_rules
  alter column user_id set default auth.uid();

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.categories enable row level security;
alter table public.category_rules enable row level security;
alter table public.categorization_audit enable row level security;
alter table public.budget_plan_settings enable row level security;
alter table public.budget_category_overrides enable row level security;
alter table public.monthly_budget_values enable row level security;
alter table public.forecast_income_sources enable row level security;
alter table public.monthly_cashflow_forecasts enable row level security;
alter table public.subscription_profiles enable row level security;
alter table public.subscription_profile_rules enable row level security;
alter table public.transaction_subscription_matches enable row level security;

-- ---------------------------------------------------------------------------
-- Remove legacy/incomplete policies first
-- ---------------------------------------------------------------------------
drop policy if exists "Users can access their own transactions" on public.transactions;
drop policy if exists "Users can access their own categories" on public.categories;
drop policy if exists "Users can access their own budget_plan_settings" on public.budget_plan_settings;
drop policy if exists "Users can access their own budget_category_overrides" on public.budget_category_overrides;
drop policy if exists "Users can access their own monthly_budget_values" on public.monthly_budget_values;

-- ---------------------------------------------------------------------------
-- Tenant-scoped tables: strict auth.uid() = user_id
-- ---------------------------------------------------------------------------
drop policy if exists transactions_owner_policy on public.transactions;
create policy transactions_owner_policy
  on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bank_accounts_owner_policy on public.bank_accounts;
create policy bank_accounts_owner_policy
  on public.bank_accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists categorization_audit_owner_policy on public.categorization_audit;
create policy categorization_audit_owner_policy
  on public.categorization_audit
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists budget_plan_settings_owner_policy on public.budget_plan_settings;
create policy budget_plan_settings_owner_policy
  on public.budget_plan_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists budget_category_overrides_owner_policy on public.budget_category_overrides;
create policy budget_category_overrides_owner_policy
  on public.budget_category_overrides
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists monthly_budget_values_owner_policy on public.monthly_budget_values;
create policy monthly_budget_values_owner_policy
  on public.monthly_budget_values
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists forecast_income_sources_owner_policy on public.forecast_income_sources;
create policy forecast_income_sources_owner_policy
  on public.forecast_income_sources
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists monthly_cashflow_forecasts_owner_policy on public.monthly_cashflow_forecasts;
create policy monthly_cashflow_forecasts_owner_policy
  on public.monthly_cashflow_forecasts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists subscription_profiles_owner_policy on public.subscription_profiles;
create policy subscription_profiles_owner_policy
  on public.subscription_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists subscription_profile_rules_owner_policy on public.subscription_profile_rules;
create policy subscription_profile_rules_owner_policy
  on public.subscription_profile_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists transaction_subscription_matches_owner_policy on public.transaction_subscription_matches;
create policy transaction_subscription_matches_owner_policy
  on public.transaction_subscription_matches
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Categories: system taxonomy is readable globally; user categories are private
-- ---------------------------------------------------------------------------
drop policy if exists categories_select_policy on public.categories;
create policy categories_select_policy
  on public.categories
  for select
  using (
    auth.uid() is not null
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists categories_insert_policy on public.categories;
create policy categories_insert_policy
  on public.categories
  for insert
  with check (
    auth.uid() = user_id
    and coalesce(is_system, false) = false
  );

drop policy if exists categories_update_policy on public.categories;
create policy categories_update_policy
  on public.categories
  for update
  using (
    auth.uid() = user_id
    and coalesce(is_system, false) = false
  )
  with check (
    auth.uid() = user_id
    and coalesce(is_system, false) = false
  );

drop policy if exists categories_delete_policy on public.categories;
create policy categories_delete_policy
  on public.categories
  for delete
  using (
    auth.uid() = user_id
    and coalesce(is_system, false) = false
  );

-- ---------------------------------------------------------------------------
-- Category rules: system/global readable; users may mutate only own user-rules
-- ---------------------------------------------------------------------------
drop policy if exists category_rules_select_policy on public.category_rules;
create policy category_rules_select_policy
  on public.category_rules
  for select
  using (
    auth.uid() is not null
    and (
      (scope in ('system', 'global_learned') and user_id is null)
      or user_id = auth.uid()
    )
  );

drop policy if exists category_rules_insert_policy on public.category_rules;
create policy category_rules_insert_policy
  on public.category_rules
  for insert
  with check (
    auth.uid() = user_id
    and scope = 'user'
  );

drop policy if exists category_rules_update_policy on public.category_rules;
create policy category_rules_update_policy
  on public.category_rules
  for update
  using (
    auth.uid() = user_id
    and scope = 'user'
  )
  with check (
    auth.uid() = user_id
    and scope = 'user'
  );

drop policy if exists category_rules_delete_policy on public.category_rules;
create policy category_rules_delete_policy
  on public.category_rules
  for delete
  using (
    auth.uid() = user_id
    and scope = 'user'
  );

commit;
