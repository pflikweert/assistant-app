-- Migration: normalize category naming (generic taxonomy) and improve review-queue coverage.
-- Goals:
-- 1) Remove brand/person specific category names/keys.
-- 2) Add missing generic subcategories from review-queue analysis.
-- 3) Add high-impact system rules for frequently recurring open-review merchants.

begin;
-- 1) Normalize non-generic category keys/names to generic taxonomy terms.
update public.categories
set key = 'housing_energy',
    name = 'Energie',
    updated_at = now()
where key = 'housing_energy_zonneplan';
update public.categories
set key = 'housing_water',
    name = 'Water',
    updated_at = now()
where key = 'housing_water_vitens';
update public.categories
set key = 'housing_municipal_taxes',
    name = 'Gemeentelijke belastingen',
    updated_at = now()
where key = 'housing_municipal_taxes_gblt';
update public.categories
set key = 'care_therapy',
    name = 'Therapie',
    updated_at = now()
where key = 'care_therapy_esther';
update public.categories
set key = 'care_psychotherapy',
    name = 'Psychotherapie',
    updated_at = now()
where key = 'care_psychotherapy_de_bree';
update public.categories
set key = 'subscriptions_online_video_streaming',
    name = 'Video streaming',
    updated_at = now()
where key = 'subscriptions_online_netflix';
update public.categories
set key = 'subscriptions_online_music_streaming',
    name = 'Muziek streaming',
    updated_at = now()
where key = 'subscriptions_online_spotify';
update public.categories
set key = 'subscriptions_online_digital_services',
    name = 'Digitale diensten',
    updated_at = now()
where key = 'subscriptions_online_google_services';
update public.categories
set key = 'subscriptions_online_gaming',
    name = 'Gaming',
    updated_at = now()
where key = 'subscriptions_online_playstation_sony';
update public.categories
set key = 'savings_investing_crypto',
    name = 'Crypto',
    updated_at = now()
where key = 'savings_investing_crypto_blox';
-- 2) Add missing generic subcategories observed in review queue.
with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('subscriptions_online_telecom_mobile', 'Mobiele telefonie', 'subscriptions_online', 'fixed', 77),
    ('subscriptions_online_internet_tv', 'Internet & TV', 'subscriptions_online', 'fixed', 78),
    ('auto_transport_car_wash', 'Autowassen', 'auto_transport', 'variable', 46),
    ('other_peer_to_peer_payments', 'Betaalverzoeken / onderlinge betalingen', 'other', 'variable', 104),
    ('leisure_takeaway_delivery', 'Afhalen & bezorging', 'leisure', 'variable', 95)
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
-- 3) Add/refresh high-impact merchant rules from open review transactions.
with desired_rules(pattern, pattern_normalized, category_key, confidence) as (
  values
    ('Vodafone', 'vodafone', 'subscriptions_online_telecom_mobile', 0.98),
    ('Vodafone Libertel', 'vodafone libertel', 'subscriptions_online_telecom_mobile', 0.99),
    ('KPN', 'kpn', 'subscriptions_online_internet_tv', 0.98),
    ('Debetrente', 'debetrente', 'subscriptions_online_bank_fees', 0.99),
    ('Tikkie', 'tikkie', 'other_peer_to_peer_payments', 0.97),
    ('Rabo Betaalverzoek', 'rabo betaalverzoek', 'other_peer_to_peer_payments', 0.97),
    ('Betaalverzoek Rabobank', 'betaalverzoek rabobank', 'other_peer_to_peer_payments', 0.97),
    ('Wasbox', 'wasbox', 'auto_transport_car_wash', 0.97),
    ('Sitedish', 'sitedish', 'leisure_takeaway_delivery', 0.96)
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
