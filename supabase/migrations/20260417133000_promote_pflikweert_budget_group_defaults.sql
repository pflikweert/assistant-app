update public.categories
set
  budget_group = 'subscriptions',
  updated_at = now()
where user_id is null
  and (
    key = 'subscriptions' or
    key like 'subscriptions\_%' escape '\' or
    key like 'subscription\_%' escape '\'
  )
  and budget_group is distinct from 'subscriptions';

update public.categories
set
  budget_group = 'savings',
  updated_at = now()
where user_id is null
  and (
    key = 'savings' or
    key = 'savings_transfer' or
    key like 'savings\_%' escape '\'
  )
  and budget_group is distinct from 'savings';

do $$
declare
  target_user_id uuid;
  promoted_count integer := 0;
  cleaned_count integer := 0;
begin
  select id
  into target_user_id
  from auth.users
  where email ilike '%pflikweert%'
  order by created_at asc
  limit 1;

  if target_user_id is null then
    raise exception 'Kon geen auth.users account vinden voor %%pflikweert%%';
  end if;

  update public.categories as categories
  set
    budget_group = overrides.budget_group,
    updated_at = now()
  from public.category_budget_group_overrides as overrides
  where overrides.user_id = target_user_id
    and overrides.category_id = categories.id
    and categories.user_id is null
    and categories.budget_group is distinct from overrides.budget_group;

  get diagnostics promoted_count = row_count;

  delete from public.category_budget_group_overrides as overrides
  using public.categories as categories
  where overrides.category_id = categories.id
    and categories.user_id is null
    and overrides.budget_group = categories.budget_group;

  get diagnostics cleaned_count = row_count;

  raise notice
    'Promoted % budgetgroep-defaults from account % and removed % redundant overrides.',
    promoted_count,
    target_user_id,
    cleaned_count;
end
$$;
