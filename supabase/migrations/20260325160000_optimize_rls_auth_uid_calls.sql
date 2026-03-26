-- Optimize RLS policies by avoiding per-row auth.uid() re-evaluation.

begin;

drop policy if exists transactions_owner_policy on public.transactions;
create policy transactions_owner_policy
  on public.transactions
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists bank_accounts_owner_policy on public.bank_accounts;
create policy bank_accounts_owner_policy
  on public.bank_accounts
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists categorization_audit_owner_policy on public.categorization_audit;
create policy categorization_audit_owner_policy
  on public.categorization_audit
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists budget_plan_settings_owner_policy on public.budget_plan_settings;
create policy budget_plan_settings_owner_policy
  on public.budget_plan_settings
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists budget_category_overrides_owner_policy on public.budget_category_overrides;
create policy budget_category_overrides_owner_policy
  on public.budget_category_overrides
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists monthly_budget_values_owner_policy on public.monthly_budget_values;
create policy monthly_budget_values_owner_policy
  on public.monthly_budget_values
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists forecast_income_sources_owner_policy on public.forecast_income_sources;
create policy forecast_income_sources_owner_policy
  on public.forecast_income_sources
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists monthly_cashflow_forecasts_owner_policy on public.monthly_cashflow_forecasts;
create policy monthly_cashflow_forecasts_owner_policy
  on public.monthly_cashflow_forecasts
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists subscription_profiles_owner_policy on public.subscription_profiles;
create policy subscription_profiles_owner_policy
  on public.subscription_profiles
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists subscription_profile_rules_owner_policy on public.subscription_profile_rules;
create policy subscription_profile_rules_owner_policy
  on public.subscription_profile_rules
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists transaction_subscription_matches_owner_policy on public.transaction_subscription_matches;
create policy transaction_subscription_matches_owner_policy
  on public.transaction_subscription_matches
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists forecast_refresh_state_owner_policy on public.forecast_refresh_state;
create policy forecast_refresh_state_owner_policy
  on public.forecast_refresh_state
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists forecast_timeline_events_owner_policy on public.forecast_timeline_events;
create policy forecast_timeline_events_owner_policy
  on public.forecast_timeline_events
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists categories_select_policy on public.categories;
create policy categories_select_policy
  on public.categories
  for select
  using (
    (select auth.uid()) is not null
    and (user_id is null or user_id = (select auth.uid()))
  );

drop policy if exists categories_insert_policy on public.categories;
create policy categories_insert_policy
  on public.categories
  for insert
  with check (
    (select auth.uid()) = user_id
    and coalesce(is_system, false) = false
  );

drop policy if exists categories_update_policy on public.categories;
create policy categories_update_policy
  on public.categories
  for update
  using (
    (select auth.uid()) = user_id
    and coalesce(is_system, false) = false
  )
  with check (
    (select auth.uid()) = user_id
    and coalesce(is_system, false) = false
  );

drop policy if exists categories_delete_policy on public.categories;
create policy categories_delete_policy
  on public.categories
  for delete
  using (
    (select auth.uid()) = user_id
    and coalesce(is_system, false) = false
  );

drop policy if exists category_rules_select_policy on public.category_rules;
create policy category_rules_select_policy
  on public.category_rules
  for select
  using (
    (select auth.uid()) is not null
    and (
      (scope in ('system', 'global_learned') and user_id is null)
      or user_id = (select auth.uid())
    )
  );

drop policy if exists category_rules_insert_policy on public.category_rules;
create policy category_rules_insert_policy
  on public.category_rules
  for insert
  with check (
    (select auth.uid()) = user_id
    and scope = 'user'
  );

drop policy if exists category_rules_update_policy on public.category_rules;
create policy category_rules_update_policy
  on public.category_rules
  for update
  using (
    (select auth.uid()) = user_id
    and scope = 'user'
  )
  with check (
    (select auth.uid()) = user_id
    and scope = 'user'
  );

drop policy if exists category_rules_delete_policy on public.category_rules;
create policy category_rules_delete_policy
  on public.category_rules
  for delete
  using (
    (select auth.uid()) = user_id
    and scope = 'user'
  );

commit;
