begin;

create table if not exists public.budget_plan_settings (
  plan_key text primary key,
  mode text not null default 'active_savings',
  adjustment_factor numeric not null default 0.9,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint budget_plan_settings_mode_check
    check (mode in ('active_savings', 'balanced', 'custom')),
  constraint budget_plan_settings_adjustment_factor_check
    check (adjustment_factor > 0 and adjustment_factor <= 1.5)
);

create table if not exists public.budget_category_overrides (
  id uuid default gen_random_uuid() primary key,
  plan_key text not null,
  category_key text not null,
  monthly_target_override numeric,
  factor_override numeric,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint budget_category_overrides_plan_fk
    foreign key (plan_key)
    references public.budget_plan_settings(plan_key)
    on delete cascade,
  constraint budget_category_overrides_category_key_check
    check (
      category_key in (
        'fixed_costs',
        'subscriptions',
        'variable_costs',
        'groceries',
        'fuel',
        'smoking',
        'other',
        'savings_target'
      )
    ),
  constraint budget_category_overrides_monthly_target_check
    check (monthly_target_override is null or monthly_target_override >= 0),
  constraint budget_category_overrides_factor_override_check
    check (factor_override is null or (factor_override > 0 and factor_override <= 1.5)),
  constraint budget_category_overrides_plan_category_unique
    unique (plan_key, category_key)
);

create table if not exists public.monthly_budget_values (
  id uuid default gen_random_uuid() primary key,
  plan_key text not null,
  month_start date not null,
  category_key text not null,
  monthly_budget numeric not null default 0,
  source text not null default 'manual',
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint monthly_budget_values_plan_fk
    foreign key (plan_key)
    references public.budget_plan_settings(plan_key)
    on delete cascade,
  constraint monthly_budget_values_category_key_check
    check (
      category_key in (
        'fixed_costs',
        'subscriptions',
        'variable_costs',
        'groceries',
        'fuel',
        'smoking',
        'other',
        'savings_target'
      )
    ),
  constraint monthly_budget_values_source_check
    check (source in ('manual', 'system')),
  constraint monthly_budget_values_monthly_budget_check
    check (monthly_budget >= 0),
  constraint monthly_budget_values_plan_month_category_unique
    unique (plan_key, month_start, category_key)
);

create index if not exists budget_category_overrides_plan_key_idx
  on public.budget_category_overrides(plan_key);
create index if not exists budget_category_overrides_category_key_idx
  on public.budget_category_overrides(category_key);
create index if not exists monthly_budget_values_plan_key_idx
  on public.monthly_budget_values(plan_key);
create index if not exists monthly_budget_values_month_start_idx
  on public.monthly_budget_values(month_start);
create index if not exists monthly_budget_values_category_key_idx
  on public.monthly_budget_values(category_key);
create index if not exists monthly_budget_values_plan_month_idx
  on public.monthly_budget_values(plan_key, month_start);

insert into public.budget_plan_settings (plan_key, mode, adjustment_factor)
values ('default', 'active_savings', 0.9)
on conflict (plan_key) do nothing;

commit;
