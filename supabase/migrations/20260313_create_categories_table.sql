-- Migration: create categories lookup table with parent/child structure

create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  is_system boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists categories_parent_idx on public.categories(parent_id);
create index if not exists categories_name_idx on public.categories(name);

insert into public.categories (key, name, parent_id, is_system)
select 'housing', 'Wonen', null, true
where not exists (select 1 from public.categories where key = 'housing');

insert into public.categories (key, name, parent_id, is_system)
select 'insurance', 'Verzekeringen', null, true
where not exists (select 1 from public.categories where key = 'insurance');

insert into public.categories (key, name, parent_id, is_system)
select 'transport', 'Vervoer', null, true
where not exists (select 1 from public.categories where key = 'transport');

insert into public.categories (key, name, parent_id, is_system)
select 'groceries', 'Boodschappen', null, true
where not exists (select 1 from public.categories where key = 'groceries');

insert into public.categories (key, name, parent_id, is_system)
select 'taxes', 'Belastingen', null, true
where not exists (select 1 from public.categories where key = 'taxes');

insert into public.categories (key, name, parent_id, is_system)
select 'income', 'Inkomen', null, true
where not exists (select 1 from public.categories where key = 'income');

insert into public.categories (key, name, parent_id, is_system)
select 'subscriptions', 'Abonnementen', null, true
where not exists (select 1 from public.categories where key = 'subscriptions');

insert into public.categories (key, name, parent_id, is_system)
select 'health', 'Zorg', null, true
where not exists (select 1 from public.categories where key = 'health');

insert into public.categories (key, name, parent_id, is_system)
select 'savings', 'Sparen', null, true
where not exists (select 1 from public.categories where key = 'savings');

insert into public.categories (key, name, parent_id, is_system)
select 'other', 'Overig', null, true
where not exists (select 1 from public.categories where key = 'other');

insert into public.categories (key, name, parent_id, is_system)
select 'housing_mortgage', 'Hypotheek/Huur', p.id, true
from public.categories p
where p.key = 'housing'
  and not exists (select 1 from public.categories where key = 'housing_mortgage');

insert into public.categories (key, name, parent_id, is_system)
select 'housing_utilities', 'Energie/Water', p.id, true
from public.categories p
where p.key = 'housing'
  and not exists (select 1 from public.categories where key = 'housing_utilities');

insert into public.categories (key, name, parent_id, is_system)
select 'insurance_health', 'Zorgverzekering', p.id, true
from public.categories p
where p.key = 'insurance'
  and not exists (select 1 from public.categories where key = 'insurance_health');

insert into public.categories (key, name, parent_id, is_system)
select 'insurance_home', 'Woonverzekering', p.id, true
from public.categories p
where p.key = 'insurance'
  and not exists (select 1 from public.categories where key = 'insurance_home');

insert into public.categories (key, name, parent_id, is_system)
select 'insurance_auto', 'Autoverzekering', p.id, true
from public.categories p
where p.key = 'insurance'
  and not exists (select 1 from public.categories where key = 'insurance_auto');

insert into public.categories (key, name, parent_id, is_system)
select 'transport_fuel', 'Brandstof', p.id, true
from public.categories p
where p.key = 'transport'
  and not exists (select 1 from public.categories where key = 'transport_fuel');

insert into public.categories (key, name, parent_id, is_system)
select 'transport_public', 'Openbaar Vervoer', p.id, true
from public.categories p
where p.key = 'transport'
  and not exists (select 1 from public.categories where key = 'transport_public');

insert into public.categories (key, name, parent_id, is_system)
select 'groceries_supermarket', 'Supermarkt', p.id, true
from public.categories p
where p.key = 'groceries'
  and not exists (select 1 from public.categories where key = 'groceries_supermarket');

insert into public.categories (key, name, parent_id, is_system)
select 'taxes_government', 'Gemeente/Belastingdienst', p.id, true
from public.categories p
where p.key = 'taxes'
  and not exists (select 1 from public.categories where key = 'taxes_government');

insert into public.categories (key, name, parent_id, is_system)
select 'income_salary', 'Salaris', p.id, true
from public.categories p
where p.key = 'income'
  and not exists (select 1 from public.categories where key = 'income_salary');

insert into public.categories (key, name, parent_id, is_system)
select 'income_benefits', 'Toeslagen', p.id, true
from public.categories p
where p.key = 'income'
  and not exists (select 1 from public.categories where key = 'income_benefits');

insert into public.categories (key, name, parent_id, is_system)
select 'subscriptions_telecom', 'Telecom', p.id, true
from public.categories p
where p.key = 'subscriptions'
  and not exists (select 1 from public.categories where key = 'subscriptions_telecom');

insert into public.categories (key, name, parent_id, is_system)
select 'subscriptions_streaming', 'Streaming', p.id, true
from public.categories p
where p.key = 'subscriptions'
  and not exists (select 1 from public.categories where key = 'subscriptions_streaming');

insert into public.categories (key, name, parent_id, is_system)
select 'health_care', 'Zorgverlener', p.id, true
from public.categories p
where p.key = 'health'
  and not exists (select 1 from public.categories where key = 'health_care');

insert into public.categories (key, name, parent_id, is_system)
select 'savings_transfer', 'Overboeking naar sparen', p.id, true
from public.categories p
where p.key = 'savings'
  and not exists (select 1 from public.categories where key = 'savings_transfer');
