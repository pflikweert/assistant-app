-- Migration: remove user-specific road-tax dependency and cleanup
-- Belastingdienst category fields to be generic and consistent.

begin;

-- Disable the user-specific rule token; generic matching is now handled
-- by details pattern + heuristic logic.
update public.category_rules
set is_active = false,
    updated_at = now()
where is_system = true
  and pattern_type = 'details_contains'
  and pattern_normalized = 'r 115 jl';

with child_budget as (
  select id
  from public.categories
  where key = 'income_child_budget'
)
update public.transactions tx
set category_id_auto = cb.id,
    category_confidence = case
      when tx.category_confidence is null then 0.99
      when tx.category_confidence < 0.99 then 0.99
      else tx.category_confidence
    end,
    category_source = case
      when tx.category_id_user is null then 'rule'
      else tx.category_source
    end,
    category_model = case
      when tx.category_id_user is null then 'system-rule-voorschot-kit-kgb'
      else tx.category_model
    end,
    categorized_at = case
      when tx.category_id_user is null then now()
      else tx.categorized_at
    end,
    updated_at = now()
from child_budget cb
where lower(coalesce(tx.details, '')) like '%voorschot kit/kgb%'
   or lower(coalesce(tx.details, '')) like '%voorschot kit kgb%'
   or lower(coalesce(tx.details, '')) like '%kindgebonden budget%';

with road_tax as (
  select id
  from public.categories
  where key = 'auto_transport_road_tax'
)
update public.transactions tx
set category_id_auto = rt.id,
    category_confidence = case
      when tx.category_confidence is null then 0.97
      when tx.category_confidence < 0.97 then 0.97
      else tx.category_confidence
    end,
    category_source = 'rule',
    category_model = 'system-heuristic-road-tax-generic',
    categorized_at = now(),
    updated_at = now()
from road_tax rt
where tx.category_id_user is null
  and tx.amount < 0
  and lower(coalesce(tx.counterparty, '')) like '%belastingdienst%'
  and split_part(lower(coalesce(tx.details, '')), '|', 1) ~
    '^[a-z0-9-]{4,16}[[:space:]]+[0-9]{2}-[0-9]{2}-[0-9]{4}[[:space:]]+t/m[[:space:]]+[0-9]{2}-[0-9]{2}-[0-9]{4}';

commit;