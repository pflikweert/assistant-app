alter table public.budget_plan_settings
  add column if not exists include_income_salary boolean not null default true,
  add column if not exists include_income_child_budget boolean not null default true,
  add column if not exists include_income_structural_other boolean not null default false,
  add column if not exists include_income_variable boolean not null default false;
