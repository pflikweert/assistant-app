begin;

alter table public.budget_plan_settings
  add column if not exists forecast_expense_source text not null default 'trend';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'budget_plan_settings_forecast_expense_source_check'
  ) then
    alter table public.budget_plan_settings
      add constraint budget_plan_settings_forecast_expense_source_check
      check (forecast_expense_source in ('trend', 'budget_settings'));
  end if;
end $$;

commit;
