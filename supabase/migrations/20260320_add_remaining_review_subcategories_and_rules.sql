-- Migration: add remaining review-driven subcategories and conservative rules
-- for personal care, tickets/events, and payment platforms.

begin;

with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('care_personal_care', 'Persoonlijke verzorging', 'care', 'variable', 36),
    ('leisure_tickets_events', 'Tickets & evenementen', 'leisure', 'variable', 96),
    ('other_payment_platforms', 'Betaalplatformen & marktplaatsen', 'other', 'variable', 106)
)
insert into public.categories (key, name, parent_id, is_system, budget_group, sort_order, updated_at)
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

with desired_rules(pattern, pattern_normalized, category_key, confidence) as (
  values
    ('Kapsalon', 'kapsalon', 'care_personal_care', 0.92),
    ('Barber', 'barber', 'care_personal_care', 0.90),

    ('Tickettekoop', 'tickettekoop', 'leisure_tickets_events', 0.95),
    ('Ticketmaster', 'ticketmaster', 'leisure_tickets_events', 0.95),
    ('Eventim', 'eventim', 'leisure_tickets_events', 0.95),

    ('Mollie', 'mollie', 'other_payment_platforms', 0.84),
    ('STRIPE', 'stripe', 'other_payment_platforms', 0.84),
    ('PAY.nl', 'pay nl', 'other_payment_platforms', 0.84),
    ('Multisafepay', 'multisafepay', 'other_payment_platforms', 0.84),
    ('Alipay', 'alipay', 'other_payment_platforms', 0.84)
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
select c.id, dr.pattern, dr.pattern_normalized, 'counterparty_contains', dr.confidence, 0, true, true, now()
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

commit;
