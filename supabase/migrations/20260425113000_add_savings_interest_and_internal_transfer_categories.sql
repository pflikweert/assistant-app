begin;

with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('income_savings_interest', 'Spaarrente', 'income', 'income', 16),
    (
      'savings_investing_internal_transfer',
      'Overboeking eigen rekening',
      'savings_investing',
      'savings',
      114
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
select
  dc.key,
  dc.name,
  parent.id,
  true,
  dc.budget_group,
  dc.sort_order,
  now()
from desired_categories dc
join public.categories parent on parent.key = dc.parent_key
on conflict (key) do update
set
  name = excluded.name,
  parent_id = excluded.parent_id,
  is_system = true,
  budget_group = excluded.budget_group,
  sort_order = excluded.sort_order,
  updated_at = now();

with desired_rules(pattern, pattern_normalized, category_key, confidence, pattern_type) as (
  values
    ('Spaarrente', 'spaarrente', 'income_savings_interest', 0.98, 'details_contains'),
    (
      'Rentebijschrijving',
      'rentebijschrijving',
      'income_savings_interest',
      0.98,
      'details_contains'
    ),
    (
      'Overboeking eigen rekening',
      'overboeking eigen rekening',
      'savings_investing_internal_transfer',
      0.95,
      'details_contains'
    ),
    (
      'TB eigen rekening',
      'tb eigen rekening',
      'savings_investing_internal_transfer',
      0.95,
      'details_contains'
    ),
    (
      'Betaalverzoeken onderlinge betalingen tb eigen rekening',
      'betaalverzoeken onderlinge betalingen tb eigen rekening',
      'savings_investing_internal_transfer',
      0.95,
      'details_contains'
    )
),
resolved_rules as (
  select
    dr.pattern,
    dr.pattern_normalized,
    dr.confidence,
    dr.pattern_type,
    c.id as category_id
  from desired_rules dr
  join public.categories c on c.key = dr.category_key
)
update public.category_rules as r
set
  category_id = rr.category_id,
  pattern = rr.pattern,
  confidence = rr.confidence,
  is_active = true,
  is_system = true,
  scope = 'system',
  user_id = null,
  updated_at = now()
from resolved_rules rr
where
  r.pattern_normalized = rr.pattern_normalized
  and r.pattern_type = rr.pattern_type
  and r.user_id is null
  and coalesce(r.scope, 'system') = 'system'
  and (r.is_system = true or r.hit_count = 0);

with desired_rules(pattern, pattern_normalized, category_key, confidence, pattern_type) as (
  values
    ('Spaarrente', 'spaarrente', 'income_savings_interest', 0.98, 'details_contains'),
    (
      'Rentebijschrijving',
      'rentebijschrijving',
      'income_savings_interest',
      0.98,
      'details_contains'
    ),
    (
      'Overboeking eigen rekening',
      'overboeking eigen rekening',
      'savings_investing_internal_transfer',
      0.95,
      'details_contains'
    ),
    (
      'TB eigen rekening',
      'tb eigen rekening',
      'savings_investing_internal_transfer',
      0.95,
      'details_contains'
    ),
    (
      'Betaalverzoeken onderlinge betalingen tb eigen rekening',
      'betaalverzoeken onderlinge betalingen tb eigen rekening',
      'savings_investing_internal_transfer',
      0.95,
      'details_contains'
    )
),
resolved_rules as (
  select
    dr.pattern,
    dr.pattern_normalized,
    dr.confidence,
    dr.pattern_type,
    c.id as category_id
  from desired_rules dr
  join public.categories c on c.key = dr.category_key
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
select
  rr.category_id,
  rr.pattern,
  rr.pattern_normalized,
  rr.pattern_type,
  rr.confidence,
  0,
  true,
  true,
  'system',
  null,
  now()
from resolved_rules rr
where not exists (
  select 1
  from public.category_rules r
  where
    r.pattern_normalized = rr.pattern_normalized
    and r.pattern_type = rr.pattern_type
    and r.user_id is null
    and coalesce(r.scope, 'system') = 'system'
);

with savings_interest_category as (
  select id
  from public.categories
  where key = 'income_savings_interest'
)
update public.transactions as tx
set
  category_id_auto = sic.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.95),
  category_source = 'rule',
  category_model = 'system-rule-savings-interest-v1',
  categorized_at = now(),
  updated_at = now()
from savings_interest_category sic
where
  tx.category_id_user is null
  and tx.category_id_auto is null
  and tx.amount > 0
  and (
    lower(coalesce(tx.details, '')) like '%spaarrente%'
    or lower(coalesce(tx.details, '')) like '%rentebijschrijving%'
  );

update public.transactions as tx
set
  category_id_auto = itc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.93),
  category_source = 'rule',
  category_model = 'system-rule-own-account-transfer-v1',
  categorized_at = now(),
  updated_at = now()
from (
  select id
  from public.categories
  where key = 'savings_investing_internal_transfer'
) itc
where
  tx.category_id_user is null
  and tx.category_id_auto is null
  and (
    lower(coalesce(tx.details, '')) like '%overboeking eigen rekening%'
    or lower(coalesce(tx.details, '')) like '%tb = eigen rekening%'
    or lower(coalesce(tx.details, '')) like '%tb eigen rekening%'
    or (
      lower(coalesce(tx.details, '')) like '%betaalverzoeken / onderlinge betalingen%'
      and lower(coalesce(tx.details, '')) like '%eigen rekening%'
    )
    or lower(coalesce(tx.counterparty, '')) like '%eigen rekening%'
  );

commit;
