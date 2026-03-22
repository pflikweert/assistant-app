begin;
alter table public.transactions
  add column if not exists budget_excluded boolean not null default false;
create index if not exists transactions_budget_excluded_idx
  on public.transactions(budget_excluded);
create index if not exists transactions_date_budget_excluded_idx
  on public.transactions(date, budget_excluded);
commit;
