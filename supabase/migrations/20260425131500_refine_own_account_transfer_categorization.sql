begin;

with desired_rules(pattern, pattern_normalized, confidence, pattern_type) as (
  values
    (
      'Betaalverzoeken onderlinge betalingen tb eigen rekening',
      'betaalverzoeken onderlinge betalingen tb eigen rekening',
      0.95,
      'details_contains'
    )
),
internal_transfer_category as (
  select id
  from public.categories
  where key = 'savings_investing_internal_transfer'
),
resolved_rules as (
  select
    dr.pattern,
    dr.pattern_normalized,
    dr.confidence,
    dr.pattern_type,
    itc.id as category_id
  from desired_rules dr
  cross join internal_transfer_category itc
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

with desired_rules(pattern, pattern_normalized, confidence, pattern_type) as (
  values
    (
      'Betaalverzoeken onderlinge betalingen tb eigen rekening',
      'betaalverzoeken onderlinge betalingen tb eigen rekening',
      0.95,
      'details_contains'
    )
),
internal_transfer_category as (
  select id
  from public.categories
  where key = 'savings_investing_internal_transfer'
),
resolved_rules as (
  select
    dr.pattern,
    dr.pattern_normalized,
    dr.confidence,
    dr.pattern_type,
    itc.id as category_id
  from desired_rules dr
  cross join internal_transfer_category itc
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

with internal_transfer_category as (
  select id
  from public.categories
  where key = 'savings_investing_internal_transfer'
),
peer_to_peer_category as (
  select id
  from public.categories
  where key = 'other_peer_to_peer_payments'
),
other_unknown_category as (
  select id
  from public.categories
  where key = 'other_unknown'
)
update public.transactions as tx
set
  category_id_auto = itc.id,
  category_confidence = greatest(coalesce(tx.category_confidence, 0), 0.95),
  category_source = 'rule',
  category_model = 'system-rule-own-account-transfer-v2',
  categorized_at = coalesce(tx.categorized_at, now()),
  updated_at = now()
from internal_transfer_category itc
left join peer_to_peer_category p2p on true
left join other_unknown_category unk on true
where
  tx.category_id_user is null
  and (
    tx.category_id_auto is null
    or tx.category_id_auto = p2p.id
    or tx.category_id_auto = unk.id
  )
  and (
    lower(coalesce(tx.details, '')) like '%overboeking eigen rekening%'
    or lower(coalesce(tx.details, '')) like '%tb = eigen rekening%'
    or lower(coalesce(tx.details, '')) like '%tb eigen rekening%'
    or lower(coalesce(tx.details, '')) like '%naar eigen rekening%'
    or (
      (
        lower(coalesce(tx.details, '')) like '%betaalverzoeken / onderlinge betalingen%'
        or lower(coalesce(tx.details, '')) like '%betaalverzoeken/onderlinge betalingen%'
      )
      and lower(coalesce(tx.details, '')) like '%eigen rekening%'
    )
    or lower(coalesce(tx.counterparty, '')) like '%eigen rekening%'
  );

commit;
