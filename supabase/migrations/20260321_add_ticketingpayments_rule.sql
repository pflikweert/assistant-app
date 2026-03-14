-- Migration: classify TicketingPayments as tickets/events

begin;

with target_category as (
  select id
  from public.categories
  where key = 'leisure_tickets_events'
), desired_rule(pattern, pattern_normalized, confidence) as (
  values ('TicketingPayments', 'ticketingpayments', 0.95)
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
select tc.id, dr.pattern, dr.pattern_normalized, 'counterparty_contains', dr.confidence, 0, true, true, now()
from desired_rule dr
cross join target_category tc
on conflict (pattern_normalized, pattern_type) do update
  set category_id = excluded.category_id,
      pattern = excluded.pattern,
      confidence = excluded.confidence,
      is_active = true,
      is_system = true,
      updated_at = now()
where public.category_rules.is_system = true
   or public.category_rules.hit_count = 0;

with target_category as (
  select id
  from public.categories
  where key = 'leisure_tickets_events'
)
update public.transactions tx
set category_id_auto = tc.id,
    category_confidence = 0.95,
    category_source = 'rule',
    category_model = 'system-rule-ticketingpayments',
    categorized_at = now(),
    updated_at = now()
from target_category tc
where tx.category_id_user is null
  and (
    lower(coalesce(tx.counterparty, '')) = 'ticketingpayments'
    or lower(coalesce(tx.details, '')) like '%ticketingpayments%'
  );

commit;