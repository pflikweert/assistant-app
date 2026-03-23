begin;
alter table public.monthly_cashflow_forecasts
  add column if not exists current_balance_anchor numeric,
  add column if not exists current_balance_anchor_date date,
  add column if not exists upcoming_committed_income_total numeric not null default 0,
  add column if not exists upcoming_committed_expense_total numeric not null default 0,
  add column if not exists lowest_expected_balance numeric,
  add column if not exists lowest_expected_balance_date date,
  add column if not exists next_expected_event_date date,
  add column if not exists next_expected_event_label text,
  add column if not exists cash_risk_flag text not null default 'none';
alter table public.monthly_cashflow_forecasts
  drop constraint if exists monthly_cashflow_forecasts_cash_risk_flag_check;
alter table public.monthly_cashflow_forecasts
  add constraint monthly_cashflow_forecasts_cash_risk_flag_check
    check (cash_risk_flag in ('none', 'cash_gap_warning'));
create index if not exists monthly_cashflow_forecasts_cash_risk_idx
  on public.monthly_cashflow_forecasts(user_id, month_start, cash_risk_flag);
commit;
