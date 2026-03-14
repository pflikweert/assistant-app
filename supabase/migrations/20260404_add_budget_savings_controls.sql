begin;

alter table public.budget_plan_settings
  add column if not exists apply_savings_target_to_variable_budget boolean not null default false,
  add column if not exists savings_target_monthly numeric not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'budget_plan_settings_savings_target_monthly_check'
  ) then
    alter table public.budget_plan_settings
      add constraint budget_plan_settings_savings_target_monthly_check
      check (savings_target_monthly >= 0);
  end if;
end $$;

commit;