-- Migration: classify all Belastingdienst BIJDRAGE ZVW transactions
-- as health insurance related (including settlements/refunds).

begin;
with health_insurance as (
  select id
  from public.categories
  where key = 'care_health_insurance'
)
update public.transactions tx
set category_id_auto = hi.id,
    category_confidence = case
      when tx.category_confidence is null then 0.96
      when tx.category_confidence < 0.96 then 0.96
      else tx.category_confidence
    end,
    category_source = 'rule',
    category_model = 'system-heuristic-zvw-contribution',
    categorized_at = now(),
    updated_at = now()
from health_insurance hi
where tx.category_id_user is null
  and lower(coalesce(tx.counterparty, '')) like '%belastingdienst%'
  and lower(coalesce(tx.details, '')) like '%bijdrage zvw%';
commit;
