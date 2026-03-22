-- Migration: fix broad Belastingdienst misclassification by adding
-- details-specific rules for child budget (KIT/KGB) and road tax references.

begin;
with desired_rules(pattern, pattern_normalized, pattern_type, category_key, confidence) as (
  values
    ('VOORSCHOT KIT/Kgb', 'voorschot kit kgb', 'details_contains', 'income_child_budget', 0.99),
    ('KINDGEBONDEN BUDGET', 'kindgebonden budget', 'details_contains', 'income_child_budget', 0.97),
    ('R-115-JL', 'r 115 jl', 'details_contains', 'auto_transport_road_tax', 0.97)
)
insert into public.category_rules (
  category_id,
  pattern,
  pattern_normalized,
  pattern_type,
  confidence,
  hit_count,
  is_active,
  is_system,
  updated_at
)
select c.id, dr.pattern, dr.pattern_normalized, dr.pattern_type, dr.confidence, 0, true, true, now()
from desired_rules dr
join public.categories c on c.key = dr.category_key
on conflict (pattern_normalized, pattern_type) do update
  set category_id = excluded.category_id,
      pattern = excluded.pattern,
      confidence = excluded.confidence,
      is_active = true,
      is_system = true,
      updated_at = now()
where public.category_rules.is_system = true
   or public.category_rules.hit_count = 0;
with child_budget as (
  select id
  from public.categories
  where key = 'income_child_budget'
)
update public.transactions tx
set category_id_auto = cb.id,
    category_confidence = 0.99,
    category_source = 'rule',
    category_model = 'system-rule-voorschot-kit-kgb',
    categorized_at = now(),
    updated_at = now()
from child_budget cb
where tx.category_id_user is null
  and (
    lower(coalesce(tx.details, '')) like '%voorschot kit/kgb%'
    or lower(coalesce(tx.details, '')) like '%voorschot kit kgb%'
    or lower(coalesce(tx.details, '')) like '%kindgebonden budget%'
  );
with road_tax as (
  select id
  from public.categories
  where key = 'auto_transport_road_tax'
)
update public.transactions tx
set category_id_auto = rt.id,
    category_confidence = 0.97,
    category_source = 'rule',
    category_model = 'system-rule-road-tax-reference',
    categorized_at = now(),
    updated_at = now()
from road_tax rt
where tx.category_id_user is null
  and lower(coalesce(tx.details, '')) like '%r-115-jl%';
commit;
