-- Migration: add missing curated subcategories for public transport and healthcare provider,
-- then remap legacy assignments/rules.

begin;
with desired_categories(key, name, parent_key, budget_group, sort_order) as (
  values
    ('auto_transport_public_transport', 'Openbaar vervoer', 'auto_transport', 'variable', 47),
    ('care_healthcare_provider', 'Zorgverlener', 'care', 'variable', 35)
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
update public.transactions t
set category_id_auto = c_new.id,
    updated_at = now(),
    categorized_at = coalesce(t.categorized_at, now())
from public.categories c_old
join public.categories c_new on c_new.key = 'auto_transport_public_transport'
where c_old.key = 'transport_public'
  and t.category_id_user is null
  and t.category_id_auto = c_old.id;
update public.transactions t
set category_id_auto = c_new.id,
    updated_at = now(),
    categorized_at = coalesce(t.categorized_at, now())
from public.categories c_old
join public.categories c_new on c_new.key = 'care_healthcare_provider'
where c_old.key = 'health_care'
  and t.category_id_user is null
  and t.category_id_auto = c_old.id;
update public.category_rules r
set category_id = c_new.id,
    updated_at = now()
from public.categories c_old
join public.categories c_new on c_new.key = 'auto_transport_public_transport'
where c_old.key = 'transport_public'
  and r.category_id = c_old.id;
update public.category_rules r
set category_id = c_new.id,
    updated_at = now()
from public.categories c_old
join public.categories c_new on c_new.key = 'care_healthcare_provider'
where c_old.key = 'health_care'
  and r.category_id = c_old.id;
commit;
