-- Migration: add categorization fields to transactions

alter table public.transactions
  add column if not exists category_id_auto uuid references public.categories(id) on delete set null,
  add column if not exists category_id_user uuid references public.categories(id) on delete set null,
  add column if not exists category_confidence numeric,
  add column if not exists category_source text,
  add column if not exists category_model text,
  add column if not exists categorized_at timestamp with time zone,
  add column if not exists updated_at timestamp with time zone not null default now();
create index if not exists transactions_category_auto_idx on public.transactions(category_id_auto);
create index if not exists transactions_category_user_idx on public.transactions(category_id_user);
create index if not exists transactions_categorized_at_idx on public.transactions(categorized_at);
