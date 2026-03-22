begin;

alter table public.forecast_income_sources
  add column if not exists income_bucket text;

alter table public.forecast_income_sources
  drop constraint if exists forecast_income_sources_income_bucket_check;

alter table public.forecast_income_sources
  add constraint forecast_income_sources_income_bucket_check
  check (
    income_bucket is null or income_bucket in (
      'salary',
      'childBudget',
      'structuralOther',
      'variable'
    )
  );

alter table public.monthly_cashflow_forecasts
  add column if not exists expected_income_structural_total numeric not null default 0,
  add column if not exists expected_income_variable_total numeric not null default 0;

update public.monthly_cashflow_forecasts
set
  expected_income_structural_total = coalesce(
    expected_income_structural_total,
    expected_income_total,
    0
  ),
  expected_income_variable_total = coalesce(expected_income_variable_total, 0);

commit;
