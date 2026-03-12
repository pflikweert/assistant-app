-- Migration: fix historical manual misclassifications for KIT/KGB advances.

begin;

with child_budget as (
  select id
  from public.categories
  where key = 'income_child_budget'
)
update public.transactions tx
set category_id_user = cb.id,
    category_source = 'manual',
    category_model = 'manual-kgb-correction',
    category_confidence = 1,
    categorized_at = coalesce(tx.categorized_at, now()),
    updated_at = now()
from child_budget cb
where lower(coalesce(tx.details, '')) like '%voorschot kit/kgb%'
  and tx.category_id_user is not null
  and tx.category_id_user <> cb.id;

commit;