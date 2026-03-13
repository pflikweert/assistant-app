begin;

alter table public.monthly_budget_values
  add column if not exists lock_trend boolean;

-- Backward compatibility for temporary experiments where source carried lock intent.
update public.monthly_budget_values
set
  lock_trend = coalesce(lock_trend, true),
  source = 'manual'
where source = 'trend_lock';

alter table public.monthly_budget_values
  drop constraint if exists monthly_budget_values_lock_trend_category_check;

alter table public.monthly_budget_values
  add constraint monthly_budget_values_lock_trend_category_check
  check (
    lock_trend is null or
    category_key in ('groceries', 'fuel', 'smoking', 'other')
  );

create index if not exists monthly_budget_values_plan_month_lock_trend_idx
  on public.monthly_budget_values(plan_key, month_start, lock_trend);

commit;
