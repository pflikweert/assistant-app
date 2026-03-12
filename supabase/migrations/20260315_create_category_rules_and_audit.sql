-- Migration: create category rules and categorization audit trail

create table if not exists public.category_rules (
  id uuid default gen_random_uuid() primary key,
  category_id uuid not null references public.categories(id) on delete cascade,
  pattern text not null,
  pattern_normalized text not null,
  pattern_type text not null default 'counterparty_contains',
  confidence numeric not null default 0.9,
  hit_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique(pattern_normalized, pattern_type)
);

create index if not exists category_rules_category_idx on public.category_rules(category_id);
create index if not exists category_rules_pattern_idx on public.category_rules(pattern_normalized);
create index if not exists category_rules_active_idx on public.category_rules(is_active);

create table if not exists public.categorization_audit (
  id uuid default gen_random_uuid() primary key,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  previous_category_id uuid references public.categories(id) on delete set null,
  new_category_id uuid not null references public.categories(id) on delete restrict,
  source text not null,
  model text,
  confidence numeric,
  reason text,
  created_at timestamp with time zone not null default now()
);

create index if not exists categorization_audit_transaction_idx on public.categorization_audit(transaction_id);
create index if not exists categorization_audit_created_idx on public.categorization_audit(created_at);
