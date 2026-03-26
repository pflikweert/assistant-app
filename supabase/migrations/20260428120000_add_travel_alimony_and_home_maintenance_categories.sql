-- Migration: add travel, alimony and home-maintenance taxonomy with conservative rules.

begin;

with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    (
      'housing_maintenance',
      'Onderhoud / schoonmaak',
      'housing',
      'variable',
      26
    ),
    (
      'leisure_travel_stays',
      'Reizen & verblijf',
      'leisure',
      'variable',
      97
    ),
    (
      'other_alimony_support',
      'Alimentatie / onderhoudsbijdrage',
      'other',
      'variable',
      105
    )
)
insert into public.categories (
  key,
  name,
  parent_id,
  is_system,
  budget_group,
  sort_order,
  updated_at
)
select dc.key, dc.name, parent.id, true, dc.budget_group, dc.sort_order, now()
from desired_categories dc
join public.categories parent on parent.key = dc.parent_key
on conflict (key) do update
  set name = excluded.name,
      parent_id = excluded.parent_id,
      is_system = true,
      budget_group = excluded.budget_group,
      sort_order = excluded.sort_order,
      updated_at = now();

with desired_rules(pattern, pattern_normalized, category_key, confidence, pattern_type) as (
  values
    (
      'Glazenwasser',
      'glazenwasser',
      'housing_maintenance',
      0.96,
      'counterparty_contains'
    ),
    (
      'Glasbewassing',
      'glasbewassing',
      'housing_maintenance',
      0.96,
      'details_contains'
    ),
    (
      'Schoonmaak',
      'schoonmaak',
      'housing_maintenance',
      0.84,
      'details_contains'
    ),
    (
      'Airbnb',
      'airbnb',
      'leisure_travel_stays',
      0.98,
      'counterparty_contains'
    ),
    (
      'Camping',
      'camping',
      'leisure_travel_stays',
      0.95,
      'counterparty_contains'
    ),
    (
      'Booking.com',
      'booking com',
      'leisure_travel_stays',
      0.94,
      'counterparty_contains'
    ),
    (
      'Roompot',
      'roompot',
      'leisure_travel_stays',
      0.95,
      'counterparty_contains'
    ),
    (
      'Landal',
      'landal',
      'leisure_travel_stays',
      0.95,
      'counterparty_contains'
    ),
    (
      'Hotel',
      'hotel',
      'leisure_travel_stays',
      0.90,
      'details_contains'
    ),
    (
      'Vakantie',
      'vakantie',
      'leisure_travel_stays',
      0.88,
      'details_contains'
    ),
    (
      'Verblijf',
      'verblijf',
      'leisure_travel_stays',
      0.88,
      'details_contains'
    ),
    (
      'Overnachting',
      'overnachting',
      'leisure_travel_stays',
      0.88,
      'details_contains'
    ),
    (
      'VakantieVeilingen',
      'vakantieveilingen',
      'leisure_travel_stays',
      0.86,
      'counterparty_contains'
    ),
    (
      'Alimentatie',
      'alimentatie',
      'other_alimony_support',
      0.98,
      'details_contains'
    ),
    (
      'Onderhoudsbijdrage',
      'onderhoudsbijdrage',
      'other_alimony_support',
      0.98,
      'details_contains'
    ),
    (
      'Partneralimentatie',
      'partneralimentatie',
      'other_alimony_support',
      0.98,
      'details_contains'
    ),
    (
      'Kinderalimentatie',
      'kinderalimentatie',
      'other_alimony_support',
      0.98,
      'details_contains'
    )
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
  scope,
  user_id,
  updated_at
)
select c.id, dr.pattern, dr.pattern_normalized, dr.pattern_type, dr.confidence, 0, true, true, 'system', null, now()
from desired_rules dr
join public.categories c on c.key = dr.category_key
on conflict (scope, pattern_normalized, pattern_type)
  where scope in ('system', 'global_learned') and user_id is null
do update
  set category_id = excluded.category_id,
      pattern = excluded.pattern,
      confidence = excluded.confidence,
      is_active = true,
      is_system = true,
      scope = excluded.scope,
      user_id = excluded.user_id,
      updated_at = now()
where public.category_rules.is_system = true
   or public.category_rules.hit_count = 0;

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.96),
  category_source = 'rule',
  category_model = 'system-rule-housing-maintenance-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'housing_maintenance'
  and (
    lower(coalesce(tx.counterparty, '')) like '%glazenwasser%'
    or lower(coalesce(tx.details, '')) like '%glazenwasser%'
    or lower(coalesce(tx.details, '')) like '%glasbewassing%'
    or lower(coalesce(tx.details, '')) like '%schoonmaak%'
  );

update public.transactions as tx
set
  category_id_auto = tc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.92),
  category_source = 'rule',
  category_model = 'system-rule-leisure-travel-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories tc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and tc.key = 'leisure_travel_stays'
  and (
    lower(coalesce(tx.counterparty, '')) like '%airbnb%'
    or lower(coalesce(tx.counterparty, '')) like '%camping%'
    or lower(coalesce(tx.counterparty, '')) like '%booking.com%'
    or lower(coalesce(tx.counterparty, '')) like '%roompot%'
    or lower(coalesce(tx.counterparty, '')) like '%landal%'
    or lower(coalesce(tx.counterparty, '')) like '%vakantieveilingen%'
    or lower(coalesce(tx.details, '')) like '%hotel%'
    or lower(coalesce(tx.details, '')) like '%vakantie%'
    or lower(coalesce(tx.details, '')) like '%verblijf%'
    or lower(coalesce(tx.details, '')) like '%overnachting%'
  );

update public.transactions as tx
set
  category_id_auto = ac.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.98),
  category_source = 'rule',
  category_model = 'system-rule-alimony-support-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories ac
where tx.category_id_user is null
  and tx.category_id_auto is null
  and ac.key = 'other_alimony_support'
  and (
    lower(coalesce(tx.details, '')) like '%alimentatie%'
    or lower(coalesce(tx.details, '')) like '%onderhoudsbijdrage%'
    or lower(coalesce(tx.details, '')) like '%partneralimentatie%'
    or lower(coalesce(tx.details, '')) like '%kinderalimentatie%'
  );

commit;
