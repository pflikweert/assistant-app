-- Migration: add transaction analysis fields and forecast storage tables

begin;
alter table public.transactions
  add column if not exists analysis_main_group text,
  add column if not exists analysis_category text,
  add column if not exists recurring boolean not null default false,
  add column if not exists recurring_type text,
  add column if not exists spending_pattern text,
  add column if not exists analysis_updated_at timestamp with time zone;
alter table public.transactions
  drop constraint if exists transactions_analysis_main_group_check;
alter table public.transactions
  add constraint transactions_analysis_main_group_check
  check (analysis_main_group in ('income', 'expense') or analysis_main_group is null);
alter table public.transactions
  drop constraint if exists transactions_analysis_category_check;
alter table public.transactions
  add constraint transactions_analysis_category_check
  check (
    analysis_category in (
      'fixed_costs',
      'subscriptions',
      'variable_costs',
      'income_structural',
      'income_variable'
    )
    or analysis_category is null
  );
alter table public.transactions
  drop constraint if exists transactions_recurring_type_check;
alter table public.transactions
  add constraint transactions_recurring_type_check
  check (
    recurring_type in ('monthly', 'quarterly', 'yearly', 'irregular')
    or recurring_type is null
  );
alter table public.transactions
  drop constraint if exists transactions_spending_pattern_check;
alter table public.transactions
  add constraint transactions_spending_pattern_check
  check (
    spending_pattern in ('frequent_small_expense')
    or spending_pattern is null
  );
create index if not exists transactions_analysis_main_group_idx
  on public.transactions(analysis_main_group);
create index if not exists transactions_analysis_category_idx
  on public.transactions(analysis_category);
create index if not exists transactions_recurring_idx
  on public.transactions(recurring);
create index if not exists transactions_recurring_type_idx
  on public.transactions(recurring_type);
create index if not exists transactions_spending_pattern_idx
  on public.transactions(spending_pattern);
create index if not exists transactions_date_analysis_idx
  on public.transactions(date, analysis_main_group, analysis_category);
create table if not exists public.forecast_income_sources (
  id uuid default gen_random_uuid() primary key,
  source_key text not null unique,
  source_label text not null,
  expected_income numeric not null,
  income_frequency text not null,
  income_day_of_month integer,
  last_detected_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint forecast_income_sources_frequency_check
    check (income_frequency in ('monthly', 'quarterly', 'yearly', 'irregular')),
  constraint forecast_income_sources_day_check
    check (income_day_of_month is null or (income_day_of_month between 1 and 31))
);
create index if not exists forecast_income_sources_frequency_idx
  on public.forecast_income_sources(income_frequency);
create table if not exists public.monthly_cashflow_forecasts (
  id uuid default gen_random_uuid() primary key,
  month_start date not null unique,
  starting_balance numeric,
  expected_income_total numeric not null default 0,
  expected_expense_total numeric not null default 0,
  expected_fixed_costs numeric not null default 0,
  expected_subscriptions numeric not null default 0,
  expected_variable_costs numeric not null default 0,
  avg_groceries numeric not null default 0,
  avg_fuel numeric not null default 0,
  avg_smoking numeric not null default 0,
  avg_other_variable numeric not null default 0,
  expected_end_of_month_balance numeric,
  risk_flag text not null default 'none',
  top_cost_bucket_1 text,
  top_cost_bucket_2 text,
  top_cost_bucket_3 text,
  computed_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint monthly_cashflow_forecasts_risk_flag_check
    check (risk_flag in ('none', 'deficit_warning'))
);
create index if not exists monthly_cashflow_forecasts_month_idx
  on public.monthly_cashflow_forecasts(month_start);
commit;
