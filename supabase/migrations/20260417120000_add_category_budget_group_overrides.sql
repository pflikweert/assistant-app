begin;

create table if not exists public.category_budget_group_overrides (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  budget_group text not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint category_budget_group_overrides_budget_group_check
    check (budget_group in ('fixed', 'variable', 'subscriptions'))
);

alter table public.category_budget_group_overrides
  alter column user_id set default auth.uid();

create unique index if not exists category_budget_group_overrides_user_category_unique
  on public.category_budget_group_overrides(user_id, category_id);

create index if not exists category_budget_group_overrides_user_id_idx
  on public.category_budget_group_overrides(user_id);

create index if not exists category_budget_group_overrides_category_id_idx
  on public.category_budget_group_overrides(category_id);

alter table public.category_budget_group_overrides enable row level security;

drop policy if exists category_budget_group_overrides_owner_policy
  on public.category_budget_group_overrides;

create policy category_budget_group_overrides_owner_policy
  on public.category_budget_group_overrides
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
