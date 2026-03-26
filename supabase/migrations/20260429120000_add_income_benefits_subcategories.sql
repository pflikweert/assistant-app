-- Migration: add income benefits leaf categories for toeslagen and tegemoetkomingen.

begin;

with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    (
      'income_benefits_housing_allowance',
      'Huurtoeslag',
      'income_benefits',
      'income',
      16
    ),
    (
      'income_benefits_health_allowance',
      'Zorgtoeslag',
      'income_benefits',
      'income',
      17
    ),
    (
      'income_benefits_childcare_allowance',
      'Kinderopvangtoeslag',
      'income_benefits',
      'income',
      18
    ),
    (
      'income_benefits_child_benefit',
      'Kinderbijslag',
      'income_benefits',
      'income',
      19
    ),
    (
      'income_benefits_foster_support',
      'Pleegvergoeding',
      'income_benefits',
      'income',
      20
    ),
    (
      'income_benefits_school_support',
      'Tegemoetkoming schoolkosten',
      'income_benefits',
      'income',
      21
    ),
    (
      'income_benefits_pgb',
      'Persoonsgebonden budget',
      'income_benefits',
      'income',
      22
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
      'Huurtoeslag',
      'huurtoeslag',
      'income_benefits_housing_allowance',
      0.99,
      'details_contains'
    ),
    (
      'Zorgtoeslag',
      'zorgtoeslag',
      'income_benefits_health_allowance',
      0.99,
      'details_contains'
    ),
    (
      'Kinderopvangtoeslag',
      'kinderopvangtoeslag',
      'income_benefits_childcare_allowance',
      0.99,
      'details_contains'
    ),
    (
      'Kinderbijslag',
      'kinderbijslag',
      'income_benefits_child_benefit',
      0.99,
      'details_contains'
    ),
    (
      'Pleegvergoeding',
      'pleegvergoeding',
      'income_benefits_foster_support',
      0.99,
      'details_contains'
    ),
    (
      'Tegemoetkoming schoolkosten',
      'tegemoetkoming schoolkosten',
      'income_benefits_school_support',
      0.99,
      'details_contains'
    ),
    (
      'Persoonsgebonden budget',
      'persoonsgebonden budget',
      'income_benefits_pgb',
      0.99,
      'details_contains'
    ),
    (
      'PGB',
      'pgb',
      'income_benefits_pgb',
      0.92,
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
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_housing_allowance'
  and lower(coalesce(tx.details, '')) like '%huurtoeslag%';

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_health_allowance'
  and lower(coalesce(tx.details, '')) like '%zorgtoeslag%';

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_childcare_allowance'
  and lower(coalesce(tx.details, '')) like '%kinderopvangtoeslag%';

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_child_benefit'
  and lower(coalesce(tx.details, '')) like '%kinderbijslag%';

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_foster_support'
  and lower(coalesce(tx.details, '')) like '%pleegvergoeding%';

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_school_support'
  and lower(coalesce(tx.details, '')) like '%tegemoetkoming schoolkosten%';

update public.transactions as tx
set
  category_id_auto = hc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.99),
  category_source = 'rule',
  category_model = 'system-rule-income-benefits-v1',
  categorized_at = now(),
  updated_at = now()
from public.categories hc
where tx.category_id_user is null
  and tx.category_id_auto is null
  and hc.key = 'income_benefits_pgb'
  and (
    lower(coalesce(tx.details, '')) like '%persoonsgebonden budget%'
    or lower(coalesce(tx.details, '')) like '% pgb%'
    or lower(coalesce(tx.details, '')) like '%pgb%'
  );

commit;
