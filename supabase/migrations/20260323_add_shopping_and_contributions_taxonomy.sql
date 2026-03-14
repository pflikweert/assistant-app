-- Migration: add missing taxonomy for durable goods and contributions,
-- and disable broad subject-driven provider rules that conflict with
-- per-transaction subject classification.

begin;

with desired_roots(key, name, budget_group, sort_order) as (
  values
    ('shopping_goods', 'Aankopen & spullen', 'variable', 55),
    ('contributions', 'Contributies & giften', 'variable', 105)
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
select dr.key, dr.name, null, true, dr.budget_group, dr.sort_order, now()
from desired_roots dr
on conflict (key) do update
  set name = excluded.name,
      parent_id = null,
      is_system = true,
      budget_group = excluded.budget_group,
      sort_order = excluded.sort_order,
      updated_at = now();

with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('shopping_goods_electronics', 'Elektronica', 'shopping_goods', 'variable', 56),
    ('shopping_goods_furniture_home', 'Meubels & wonen', 'shopping_goods', 'variable', 57),
    ('shopping_goods_general_retail', 'Webshops & overige spullen', 'shopping_goods', 'variable', 58),
    ('contributions_memberships', 'Verenigingen & contributies', 'contributions', 'variable', 106),
    ('contributions_donations', 'Donaties & goede doelen', 'contributions', 'variable', 107),
    ('contributions_religious', 'Kerk & geloofsgemeenschap', 'contributions', 'variable', 108)
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

-- Only add rules for merchants/labels that are category-specific enough.
-- Broad webshops intentionally stay without system rules so AI/manual review
-- can use the actual purchase subject.
with desired_rules(pattern, pattern_normalized, category_key, confidence) as (
  values
    ('MediaMarkt', 'mediamarkt', 'shopping_goods_electronics', 0.95),
    ('Coolblue', 'coolblue', 'shopping_goods_electronics', 0.95),
    ('BCC', 'bcc', 'shopping_goods_electronics', 0.90),

    ('IKEA', 'ikea', 'shopping_goods_furniture_home', 0.96),
    ('JYSK', 'jysk', 'shopping_goods_furniture_home', 0.95),
    ('Leen Bakker', 'leen bakker', 'shopping_goods_furniture_home', 0.95),
    ('Kwantum', 'kwantum', 'shopping_goods_furniture_home', 0.95),
    ('Profijt Meubel', 'profijt meubel', 'shopping_goods_furniture_home', 0.94),

    ('Contributie', 'contributie', 'contributions_memberships', 0.84),
    ('Lidmaatschap', 'lidmaatschap', 'contributions_memberships', 0.84),
    ('Donatie', 'donatie', 'contributions_donations', 0.90),
    ('ANBI', 'anbi', 'contributions_donations', 0.88),
    ('GoFundMe', 'gofundme', 'contributions_donations', 0.94),
    ('KWF', 'kwf', 'contributions_donations', 0.97),
    ('KiKa', 'kika', 'contributions_donations', 0.97),
    ('Rode Kruis', 'rode kruis', 'contributions_donations', 0.97),
    ('UNICEF', 'unicef', 'contributions_donations', 0.97),
    ('Greenpeace', 'greenpeace', 'contributions_donations', 0.97),
    ('Natuurmonumenten', 'natuurmonumenten', 'contributions_donations', 0.96),
    ('Kerkbalans', 'kerkbalans', 'contributions_religious', 0.97),
    ('Parochie', 'parochie', 'contributions_religious', 0.90),
    ('Diaconie', 'diaconie', 'contributions_religious', 0.90)
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

-- Provider-level counterparty rules are too broad for Klarna/PayPal-style
-- intermediaries, because different payments can belong to different subjects.
update public.category_rules
set is_active = false,
    updated_at = now()
where pattern_type = 'counterparty_contains'
  and is_system = true
  and pattern_normalized in (
    'paypal',
    'klarna',
    'riverty',
    'afterpay',
    'billink',
    'in3',
    'sprinque'
  );

-- Clear existing automatic rule-based categories for these providers so they
-- can be re-evaluated with the subject-aware flow.
update public.transactions
set category_id_auto = null,
    category_confidence = null,
    category_source = null,
    category_model = null,
    categorized_at = null,
    updated_at = now()
where category_id_user is null
  and category_source = 'rule'
  and (
    lower(coalesce(counterparty, '')) like '%paypal%'
    or lower(coalesce(counterparty, '')) like '%klarna%'
    or lower(coalesce(counterparty, '')) like '%riverty%'
    or lower(coalesce(counterparty, '')) like '%afterpay%'
    or lower(coalesce(counterparty, '')) like '%billink%'
    or lower(coalesce(counterparty, '')) like '%in3%'
    or lower(coalesce(counterparty, '')) like '%sprinque%'
  );

commit;