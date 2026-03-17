begin;

alter table public.monthly_cashflow_forecasts
  add column if not exists forecast_reference_date date,
  add column if not exists booked_income_total numeric not null default 0,
  add column if not exists booked_expense_total numeric not null default 0,
  add column if not exists booked_savings_outflow_total numeric not null default 0,
  add column if not exists remaining_expected_income_total numeric not null default 0,
  add column if not exists remaining_expected_expense_total numeric not null default 0,
  add column if not exists remaining_expected_savings_outflow_total numeric not null default 0,
  add column if not exists expected_savings_outflow_total numeric not null default 0,
  add column if not exists expected_cash_out_total numeric not null default 0,
  add column if not exists upcoming_committed_savings_outflow_total numeric not null default 0;

update public.monthly_cashflow_forecasts
set
  forecast_reference_date = coalesce(
    forecast_reference_date,
    current_balance_anchor_date,
    month_start
  ),
  booked_income_total = coalesce(booked_income_total, 0),
  booked_expense_total = coalesce(booked_expense_total, 0),
  booked_savings_outflow_total = coalesce(booked_savings_outflow_total, 0),
  remaining_expected_income_total = coalesce(
    remaining_expected_income_total,
    expected_income_total
  ),
  remaining_expected_expense_total = coalesce(
    remaining_expected_expense_total,
    expected_expense_total
  ),
  remaining_expected_savings_outflow_total = coalesce(
    remaining_expected_savings_outflow_total,
    expected_savings_outflow_total,
    0
  ),
  expected_savings_outflow_total = coalesce(expected_savings_outflow_total, 0),
  expected_cash_out_total = coalesce(
    expected_cash_out_total,
    expected_expense_total + coalesce(expected_savings_outflow_total, 0)
  ),
  upcoming_committed_savings_outflow_total = coalesce(
    upcoming_committed_savings_outflow_total,
    0
  );

commit;
