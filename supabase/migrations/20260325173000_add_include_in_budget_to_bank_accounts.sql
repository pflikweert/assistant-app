alter table public.bank_accounts
  add column if not exists include_in_budget boolean not null default true;
