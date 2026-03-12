begin;

alter table public.transactions
  drop constraint if exists transactions_analysis_category_check;

alter table public.transactions
  add constraint transactions_analysis_category_check
  check (
    analysis_category in (
      'fixed_costs',
      'subscriptions',
      'variable_costs',
      'savings_transfer',
      'income_structural',
      'income_variable'
    )
    or analysis_category is null
  );

with savings_categories as (
  select id
  from public.categories
  where budget_group = 'savings'
     or key = 'savings'
     or key = 'savings_transfer'
    or key like 'savings\_%' escape '\'
)
update public.transactions as t
set
  analysis_main_group = 'expense',
  analysis_category = 'savings_transfer',
  analysis_updated_at = now(),
  updated_at = now()
where
  t.amount < 0
  and (
    t.category_id_user in (select id from savings_categories)
    or (
      t.category_id_user is null
      and t.category_id_auto in (select id from savings_categories)
    )
  )
  and coalesce(t.analysis_category, '') <> 'savings_transfer';

commit;
