-- Migration: backfill missing financial subcategories and rules after the
-- initial category structure alignment.

alter table public.category_rules
  add column if not exists is_system boolean not null default false;
with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('income', 'Inkomen', null, 'income', 10),
    ('housing', 'Wonen', null, 'fixed', 20),
    ('care', 'Zorg', null, 'fixed', 30),
    ('auto_transport', 'Auto & Transport', null, 'variable', 40),
    ('groceries_household', 'Boodschappen & huishouden', null, 'variable', 50),
    ('smoking', 'Roken', null, 'variable', 60),
    ('subscriptions_online', 'Abonnementen & online', null, 'fixed', 70),
    ('children', 'Kinderen', null, 'variable', 80),
    ('leisure', 'Vrije tijd', null, 'variable', 90),
    ('other', 'Overig', null, 'variable', 100),
    ('savings_investing', 'Sparen & Investeren', null, 'savings', 110),

    ('income_salary', 'Salaris', 'income', 'income', 11),
    ('income_child_budget', 'Kindgebonden budget', 'income', 'income', 12),
    ('income_tax_refund', 'Belasting teruggave', 'income', 'income', 13),
    ('income_work_reimbursements', 'Declaraties werk', 'income', 'income', 14),
    ('income_other_sales', 'Verkoop / overige inkomsten', 'income', 'income', 15),

    ('housing_mortgage', 'Hypotheek', 'housing', 'fixed', 21),
    ('housing_energy_zonneplan', 'Energie (Zonneplan)', 'housing', 'fixed', 22),
    ('housing_water_vitens', 'Water (Vitens)', 'housing', 'fixed', 23),
    ('housing_municipal_taxes_gblt', 'Gemeentelijke belastingen / GBLT', 'housing', 'fixed', 24),
    ('housing_central_heating_rental', 'CV installatie huur', 'housing', 'fixed', 25),

    ('care_health_insurance', 'Zorgverzekering', 'care', 'fixed', 31),
    ('care_therapy_esther', 'Therapie Esther', 'care', 'fixed', 32),
    ('care_psychotherapy_de_bree', 'Psychotherapie S. de Bree', 'care', 'fixed', 33),
    ('care_medication_pharmacy', 'Medicatie / apotheek', 'care', 'variable', 34),

    ('auto_transport_fuel', 'Brandstof', 'auto_transport', 'variable', 41),
    ('auto_transport_car_insurance', 'Autoverzekering', 'auto_transport', 'fixed', 42),
    ('auto_transport_road_tax', 'Wegenbelasting', 'auto_transport', 'fixed', 43),
    ('auto_transport_maintenance_garage', 'Onderhoud / garage', 'auto_transport', 'variable', 44),
    ('auto_transport_parking', 'Parkeren', 'auto_transport', 'variable', 45),

    ('groceries_household_supermarket', 'Supermarkt', 'groceries_household', 'variable', 51),
    ('groceries_household_drugstore', 'Drogist', 'groceries_household', 'variable', 52),
    ('groceries_household_household_items', 'Huishoudelijke artikelen', 'groceries_household', 'variable', 53),

    ('smoking_cigarettes', 'Sigaretten', 'smoking', 'variable', 61),
    ('smoking_tobacco', 'Tabak', 'smoking', 'variable', 62),

    ('subscriptions_online_netflix', 'Netflix', 'subscriptions_online', 'fixed', 71),
    ('subscriptions_online_spotify', 'Spotify', 'subscriptions_online', 'fixed', 72),
    ('subscriptions_online_google_services', 'Google services', 'subscriptions_online', 'fixed', 73),
    ('subscriptions_online_playstation_sony', 'Playstation / Sony', 'subscriptions_online', 'fixed', 74),
    ('subscriptions_online_apps_software', 'Apps / software', 'subscriptions_online', 'fixed', 75),
    ('subscriptions_online_bank_fees', 'Bankkosten', 'subscriptions_online', 'fixed', 76),

    ('children_clothing_allowance', 'Kleedgeld', 'children', 'variable', 81),
    ('children_allowance', 'Zakgeld', 'children', 'variable', 82),
    ('children_school_costs', 'Schoolkosten', 'children', 'variable', 83),
    ('children_activities', 'Activiteiten', 'children', 'variable', 84),

    ('leisure_dining_out', 'Uit eten', 'leisure', 'variable', 91),
    ('leisure_clothing', 'Kleding', 'leisure', 'variable', 92),
    ('leisure_hobby', 'Hobby', 'leisure', 'variable', 93),
    ('leisure_gifts', 'Cadeaus', 'leisure', 'variable', 94),

    ('other_small_expenses', 'Kleine uitgaven', 'other', 'variable', 101),
    ('other_gas_station_snacks', 'Tankstation snacks', 'other', 'variable', 102),
    ('other_unknown', 'Onbekend', 'other', 'variable', 103),

    ('savings_investing_savings', 'Sparen', 'savings_investing', 'savings', 111),
    ('savings_investing_crypto_blox', 'Crypto (Blox)', 'savings_investing', 'savings', 112),
    ('savings_investing_investments', 'Beleggingen', 'savings_investing', 'savings', 113)
)
insert into public.categories (key, name, parent_id, is_system, budget_group, sort_order, updated_at)
select dc.key, dc.name, null, true, dc.budget_group, dc.sort_order, now()
from desired_categories dc
where dc.parent_key is null
on conflict (key) do update
  set name = excluded.name,
      parent_id = null,
      is_system = true,
      budget_group = excluded.budget_group,
      sort_order = excluded.sort_order,
      updated_at = now();
with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('income_salary', 'Salaris', 'income', 'income', 11),
    ('income_child_budget', 'Kindgebonden budget', 'income', 'income', 12),
    ('income_tax_refund', 'Belasting teruggave', 'income', 'income', 13),
    ('income_work_reimbursements', 'Declaraties werk', 'income', 'income', 14),
    ('income_other_sales', 'Verkoop / overige inkomsten', 'income', 'income', 15),
    ('housing_mortgage', 'Hypotheek', 'housing', 'fixed', 21),
    ('housing_energy_zonneplan', 'Energie (Zonneplan)', 'housing', 'fixed', 22),
    ('housing_water_vitens', 'Water (Vitens)', 'housing', 'fixed', 23),
    ('housing_municipal_taxes_gblt', 'Gemeentelijke belastingen / GBLT', 'housing', 'fixed', 24),
    ('housing_central_heating_rental', 'CV installatie huur', 'housing', 'fixed', 25),
    ('care_health_insurance', 'Zorgverzekering', 'care', 'fixed', 31),
    ('care_therapy_esther', 'Therapie Esther', 'care', 'fixed', 32),
    ('care_psychotherapy_de_bree', 'Psychotherapie S. de Bree', 'care', 'fixed', 33),
    ('care_medication_pharmacy', 'Medicatie / apotheek', 'care', 'variable', 34),
    ('auto_transport_fuel', 'Brandstof', 'auto_transport', 'variable', 41),
    ('auto_transport_car_insurance', 'Autoverzekering', 'auto_transport', 'fixed', 42),
    ('auto_transport_road_tax', 'Wegenbelasting', 'auto_transport', 'fixed', 43),
    ('auto_transport_maintenance_garage', 'Onderhoud / garage', 'auto_transport', 'variable', 44),
    ('auto_transport_parking', 'Parkeren', 'auto_transport', 'variable', 45),
    ('groceries_household_supermarket', 'Supermarkt', 'groceries_household', 'variable', 51),
    ('groceries_household_drugstore', 'Drogist', 'groceries_household', 'variable', 52),
    ('groceries_household_household_items', 'Huishoudelijke artikelen', 'groceries_household', 'variable', 53),
    ('smoking_cigarettes', 'Sigaretten', 'smoking', 'variable', 61),
    ('smoking_tobacco', 'Tabak', 'smoking', 'variable', 62),
    ('subscriptions_online_netflix', 'Netflix', 'subscriptions_online', 'fixed', 71),
    ('subscriptions_online_spotify', 'Spotify', 'subscriptions_online', 'fixed', 72),
    ('subscriptions_online_google_services', 'Google services', 'subscriptions_online', 'fixed', 73),
    ('subscriptions_online_playstation_sony', 'Playstation / Sony', 'subscriptions_online', 'fixed', 74),
    ('subscriptions_online_apps_software', 'Apps / software', 'subscriptions_online', 'fixed', 75),
    ('subscriptions_online_bank_fees', 'Bankkosten', 'subscriptions_online', 'fixed', 76),
    ('children_clothing_allowance', 'Kleedgeld', 'children', 'variable', 81),
    ('children_allowance', 'Zakgeld', 'children', 'variable', 82),
    ('children_school_costs', 'Schoolkosten', 'children', 'variable', 83),
    ('children_activities', 'Activiteiten', 'children', 'variable', 84),
    ('leisure_dining_out', 'Uit eten', 'leisure', 'variable', 91),
    ('leisure_clothing', 'Kleding', 'leisure', 'variable', 92),
    ('leisure_hobby', 'Hobby', 'leisure', 'variable', 93),
    ('leisure_gifts', 'Cadeaus', 'leisure', 'variable', 94),
    ('other_small_expenses', 'Kleine uitgaven', 'other', 'variable', 101),
    ('other_gas_station_snacks', 'Tankstation snacks', 'other', 'variable', 102),
    ('other_unknown', 'Onbekend', 'other', 'variable', 103),
    ('savings_investing_savings', 'Sparen', 'savings_investing', 'savings', 111),
    ('savings_investing_crypto_blox', 'Crypto (Blox)', 'savings_investing', 'savings', 112),
    ('savings_investing_investments', 'Beleggingen', 'savings_investing', 'savings', 113)
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
    ('Jumbo', 'jumbo', 'groceries_household_supermarket', 0.98),
    ('Plus', 'plus', 'groceries_household_supermarket', 0.98),
    ('Albert Heijn', 'albert heijn', 'groceries_household_supermarket', 0.98),
    ('Coop', 'coop', 'groceries_household_supermarket', 0.96),
    ('Attent', 'attent', 'groceries_household_supermarket', 0.95),
    ('Shell', 'shell', 'auto_transport_fuel', 0.98),
    ('BP', 'bp', 'auto_transport_fuel', 0.97),
    ('Esso', 'esso', 'auto_transport_fuel', 0.97),
    ('Tango', 'tango', 'auto_transport_fuel', 0.97),
    ('Tinq', 'tinq', 'auto_transport_fuel', 0.97),
    ('Tabak', 'tabak', 'smoking_tobacco', 0.97),
    ('Tobacco', 'tobacco', 'smoking_tobacco', 0.97),
    ('Unive', 'unive', 'auto_transport_car_insurance', 0.99),
    ('Zonneplan', 'zonneplan', 'housing_energy_zonneplan', 0.99),
    ('Vitens', 'vitens', 'housing_water_vitens', 0.99),
    ('Belastingdienst', 'belastingdienst', 'income_tax_refund', 0.88),
    ('GBLT', 'gblt', 'housing_municipal_taxes_gblt', 0.99),
    ('Netflix', 'netflix', 'subscriptions_online_netflix', 0.99),
    ('Spotify', 'spotify', 'subscriptions_online_spotify', 0.99),
    ('Google', 'google', 'subscriptions_online_google_services', 0.96),
    ('Sony', 'sony', 'subscriptions_online_playstation_sony', 0.96),
    ('Playstation', 'playstation', 'subscriptions_online_playstation_sony', 0.96),
    ('PayPal', 'paypal', 'subscriptions_online_apps_software', 0.82),
    ('Impres BV', 'impres bv', 'income_salary', 0.99),
    ('Zilveren Kruis', 'zilveren kruis', 'care_health_insurance', 0.98)
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
