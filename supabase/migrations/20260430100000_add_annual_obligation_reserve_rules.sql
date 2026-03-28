begin;

create table if not exists public.annual_obligation_reserve_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope_view text not null default 'personal',
  label text not null,
  semantic_tag text null,
  annual_amount numeric(12,2) not null default 0,
  monthly_amount numeric(12,2) not null default 0,
  status text not null default 'active',
  source text not null default 'manual',
  fingerprint text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint annual_obligation_reserve_rules_scope_check
    check (scope_view in ('personal', 'shared', 'household', 'observation')),
  constraint annual_obligation_reserve_rules_status_check
    check (status in ('active', 'paused')),
  constraint annual_obligation_reserve_rules_source_check
    check (source in ('inferred', 'manual'))
);

create unique index if not exists annual_obligation_reserve_rules_user_scope_fingerprint_unique
  on public.annual_obligation_reserve_rules(user_id, scope_view, fingerprint)
  where fingerprint is not null;

create index if not exists annual_obligation_reserve_rules_user_scope_status_idx
  on public.annual_obligation_reserve_rules(user_id, scope_view, status);

alter table public.annual_obligation_reserve_rules enable row level security;

drop policy if exists annual_obligation_reserve_rules_owner_policy
  on public.annual_obligation_reserve_rules;

create policy annual_obligation_reserve_rules_owner_policy
  on public.annual_obligation_reserve_rules
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
