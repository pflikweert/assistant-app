begin;

-- ---------------------------------------------------------------------------
-- Profiles and admin role
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('user', 'admin'))
);

create index if not exists profiles_role_idx
  on public.profiles(role);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();

create or replace function public.is_admin_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = coalesce(target_user_id, auth.uid())
      and p.role = 'admin'
  );
$$;

insert into public.profiles (user_id, role)
select
  u.id,
  case
    when lower(coalesce(u.email, '')) like '%pflikweert%'
      or lower(coalesce(u.email, '')) like '%pieter%'
      or lower(coalesce(u.email, '')) like '%budio%'
      then 'admin'
    else 'user'
  end
from auth.users u
on conflict (user_id) do update
set role = case
  when excluded.role = 'admin' then 'admin'
  else public.profiles.role
end;

alter table public.profiles enable row level security;
drop policy if exists profiles_select_own_policy on public.profiles;
create policy profiles_select_own_policy
  on public.profiles
  for select
  using (auth.uid() = user_id);
drop policy if exists profiles_service_insert_policy on public.profiles;
create policy profiles_service_insert_policy
  on public.profiles
  for insert
  with check (auth.role() = 'service_role');
drop policy if exists profiles_service_update_policy on public.profiles;
create policy profiles_service_update_policy
  on public.profiles
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
drop policy if exists profiles_service_delete_policy on public.profiles;
create policy profiles_service_delete_policy
  on public.profiles
  for delete
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- AI route settings
-- ---------------------------------------------------------------------------
create table if not exists public.ai_route_settings (
  use_case text primary key,
  model text not null,
  agent_mode text not null,
  temperature numeric(4,2) not null default 0.2,
  max_tokens integer not null default 800,
  fallback_enabled boolean not null default true,
  response_mode text not null default 'text',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_route_settings_temperature_check check (temperature >= 0 and temperature <= 2),
  constraint ai_route_settings_max_tokens_check check (max_tokens > 0 and max_tokens <= 8192),
  constraint ai_route_settings_response_mode_check check (response_mode in ('text', 'json_object', 'json_schema'))
);

create index if not exists ai_route_settings_updated_at_idx
  on public.ai_route_settings(updated_at desc);

create or replace function public.set_ai_route_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_route_settings_set_updated_at on public.ai_route_settings;
create trigger ai_route_settings_set_updated_at
  before update on public.ai_route_settings
  for each row
  execute function public.set_ai_route_settings_updated_at();

insert into public.ai_route_settings (
  use_case,
  model,
  agent_mode,
  temperature,
  max_tokens,
  fallback_enabled,
  response_mode
)
values
  ('help_general', 'gpt-4.1-mini', 'chat', 0.20, 800, true, 'text'),
  ('help_spending_advice', 'gpt-4.1-mini', 'chat', 0.20, 800, true, 'json_object'),
  ('budget_coach', 'gpt-4.1-mini', 'analysis', 0.20, 900, true, 'json_schema'),
  ('transaction_categorization', 'gpt-4.1-mini', 'classification', 0.00, 700, true, 'json_schema'),
  ('import_pdf_mapping', 'gpt-4.1-mini', 'extraction', 0.00, 1600, true, 'json_object')
on conflict (use_case) do nothing;

alter table public.ai_route_settings enable row level security;
drop policy if exists ai_route_settings_select_admin_policy on public.ai_route_settings;
create policy ai_route_settings_select_admin_policy
  on public.ai_route_settings
  for select
  using (public.is_admin_user(auth.uid()));
drop policy if exists ai_route_settings_insert_admin_policy on public.ai_route_settings;
create policy ai_route_settings_insert_admin_policy
  on public.ai_route_settings
  for insert
  with check (public.is_admin_user(auth.uid()));
drop policy if exists ai_route_settings_update_admin_policy on public.ai_route_settings;
create policy ai_route_settings_update_admin_policy
  on public.ai_route_settings
  for update
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));
drop policy if exists ai_route_settings_delete_admin_policy on public.ai_route_settings;
create policy ai_route_settings_delete_admin_policy
  on public.ai_route_settings
  for delete
  using (public.is_admin_user(auth.uid()));

-- ---------------------------------------------------------------------------
-- AI usage logs
-- ---------------------------------------------------------------------------
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_role text,
  use_case text not null,
  route_name text,
  screen_id text,
  screen_title text,
  model text,
  agent_mode text,
  response_mode text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer not null default 0,
  estimated_cost_eur numeric(10,4) not null default 0,
  usage_source text not null default 'estimated',
  used_fallback boolean not null default false,
  fallback_reason text,
  is_error boolean not null default false,
  error_code text,
  error_message text,
  http_status integer,
  response_id text,
  request_meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_created_at_idx
  on public.ai_usage_logs(created_at desc);
create index if not exists ai_usage_logs_use_case_created_idx
  on public.ai_usage_logs(use_case, created_at desc);
create index if not exists ai_usage_logs_user_created_idx
  on public.ai_usage_logs(user_id, created_at desc);

alter table public.ai_usage_logs enable row level security;
drop policy if exists ai_usage_logs_admin_select_policy on public.ai_usage_logs;
create policy ai_usage_logs_admin_select_policy
  on public.ai_usage_logs
  for select
  using (public.is_admin_user(auth.uid()));
drop policy if exists ai_usage_logs_service_insert_policy on public.ai_usage_logs;
create policy ai_usage_logs_service_insert_policy
  on public.ai_usage_logs
  for insert
  with check (auth.role() = 'service_role');
drop policy if exists ai_usage_logs_service_update_policy on public.ai_usage_logs;
create policy ai_usage_logs_service_update_policy
  on public.ai_usage_logs
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
drop policy if exists ai_usage_logs_service_delete_policy on public.ai_usage_logs;
create policy ai_usage_logs_service_delete_policy
  on public.ai_usage_logs
  for delete
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- AI review inbox
-- ---------------------------------------------------------------------------
create table if not exists public.ai_review_items (
  id uuid primary key default gen_random_uuid(),
  issue_key text not null unique,
  user_id uuid,
  use_case text not null,
  route_name text,
  screen_id text,
  screen_title text,
  reason_type text not null,
  status text not null default 'nieuw',
  summary text not null,
  detail text,
  conversation_excerpt jsonb,
  confidence text,
  source_log_id uuid references public.ai_usage_logs(id) on delete set null,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_review_items_status_check check (status in ('nieuw', 'bekeken', 'opgelost'))
);

create index if not exists ai_review_items_status_idx
  on public.ai_review_items(status);
create index if not exists ai_review_items_reason_type_idx
  on public.ai_review_items(reason_type);
create index if not exists ai_review_items_last_seen_at_idx
  on public.ai_review_items(last_seen_at desc);
create index if not exists ai_review_items_use_case_idx
  on public.ai_review_items(use_case);

create or replace function public.set_ai_review_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_review_items_set_updated_at on public.ai_review_items;
create trigger ai_review_items_set_updated_at
  before update on public.ai_review_items
  for each row
  execute function public.set_ai_review_items_updated_at();

alter table public.ai_review_items enable row level security;
drop policy if exists ai_review_items_admin_select_policy on public.ai_review_items;
create policy ai_review_items_admin_select_policy
  on public.ai_review_items
  for select
  using (public.is_admin_user(auth.uid()));
drop policy if exists ai_review_items_admin_update_policy on public.ai_review_items;
create policy ai_review_items_admin_update_policy
  on public.ai_review_items
  for update
  using (public.is_admin_user(auth.uid()))
  with check (public.is_admin_user(auth.uid()));
drop policy if exists ai_review_items_service_insert_policy on public.ai_review_items;
create policy ai_review_items_service_insert_policy
  on public.ai_review_items
  for insert
  with check (auth.role() = 'service_role');
drop policy if exists ai_review_items_service_delete_policy on public.ai_review_items;
create policy ai_review_items_service_delete_policy
  on public.ai_review_items
  for delete
  using (auth.role() = 'service_role');

commit;
