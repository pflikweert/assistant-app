begin;

alter table public.bank_accounts
  add column if not exists forecast_role text not null default 'operational',
  add column if not exists include_in_cashflow boolean not null default true,
  add column if not exists include_in_net_worth boolean not null default true,
  add column if not exists owner_scope text not null default 'personal';

update public.bank_accounts
set owner_scope = case
  when lower(coalesce(name, '') || ' ' || coalesce(provider, '')) ~ '(gezamenlijk|shared|joint|huishoud|partner)' then 'shared'
  when lower(coalesce(name, '') || ' ' || coalesce(provider, '')) ~ '(kind|child|jeugd|kids|zakgeld)' then 'child'
  when account_type in ('credit', 'loan') then 'external'
  else coalesce(owner_scope, 'personal')
end,
forecast_role = case
  when is_active = false then 'observation_only'
  when account_type = 'savings' then 'reserve'
  when account_type = 'investment' then 'goal'
  when account_type in ('credit', 'loan') then 'excluded'
  when lower(coalesce(name, '') || ' ' || coalesce(provider, '')) ~ '(gezamenlijk|shared|joint|huishoud|partner)' then 'shared'
  else coalesce(forecast_role, 'operational')
end,
include_in_cashflow = case
  when account_type in ('savings', 'investment', 'credit', 'loan') then false
  else coalesce(include_in_cashflow, true)
end,
include_in_net_worth = case
  when account_type in ('credit', 'loan') then true
  else coalesce(include_in_net_worth, true)
end
where true;

alter table public.bank_accounts
  drop constraint if exists bank_accounts_owner_scope_check;
alter table public.bank_accounts
  add constraint bank_accounts_owner_scope_check
  check (owner_scope in ('personal', 'shared', 'child', 'external'));
alter table public.bank_accounts
  drop constraint if exists bank_accounts_forecast_role_check;
alter table public.bank_accounts
  add constraint bank_accounts_forecast_role_check
  check (forecast_role in ('operational', 'reserve', 'goal', 'shared', 'observation_only', 'excluded'));

create table if not exists public.finance_view_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  money_view_scope text not null default 'personal',
  created_at timestamp with time zone not null default timezone('utc', now()),
  updated_at timestamp with time zone not null default timezone('utc', now()),
  constraint finance_view_preferences_money_view_scope_check
    check (money_view_scope in ('personal', 'shared', 'household', 'observation'))
);

insert into public.finance_view_preferences (user_id, money_view_scope)
select distinct user_id, 'personal'
from public.bank_accounts
where user_id is not null
on conflict (user_id) do nothing;

alter table public.finance_view_preferences enable row level security;
drop policy if exists finance_view_preferences_owner_policy on public.finance_view_preferences;
create policy finance_view_preferences_owner_policy
  on public.finance_view_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.monthly_cashflow_forecasts
  add column if not exists scope_view text not null default 'personal';
update public.monthly_cashflow_forecasts
set scope_view = coalesce(scope_view, 'personal');
alter table public.monthly_cashflow_forecasts
  drop constraint if exists monthly_cashflow_forecasts_user_month_unique;
alter table public.monthly_cashflow_forecasts
  add constraint monthly_cashflow_forecasts_user_scope_month_unique
  unique (user_id, scope_view, month_start);
create index if not exists monthly_cashflow_forecasts_user_scope_month_idx
  on public.monthly_cashflow_forecasts(user_id, scope_view, month_start);

alter table public.forecast_timeline_events
  add column if not exists scope_view text not null default 'personal';
update public.forecast_timeline_events
set scope_view = coalesce(scope_view, 'personal');
alter table public.forecast_timeline_events
  drop constraint if exists forecast_timeline_events_user_month_event_unique;
alter table public.forecast_timeline_events
  add constraint forecast_timeline_events_user_scope_month_event_unique
  unique (user_id, scope_view, month_start, event_key);
create index if not exists forecast_timeline_events_user_scope_month_date_idx
  on public.forecast_timeline_events(user_id, scope_view, month_start, event_date);
create index if not exists forecast_timeline_events_user_scope_month_type_idx
  on public.forecast_timeline_events(user_id, scope_view, month_start, event_type);

commit;
