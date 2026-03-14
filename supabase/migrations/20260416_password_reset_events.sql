-- Migration: add password_reset_events table and log policy

begin;

create table if not exists public.password_reset_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method text not null default 'recovery_email',
  ip text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_events_user_id_idx
  on public.password_reset_events(user_id);
create index if not exists password_reset_events_created_at_idx
  on public.password_reset_events(created_at desc);

alter table public.password_reset_events enable row level security;

create policy password_reset_events_service_insert
  on public.password_reset_events
  for insert
  with check (auth.role() = 'service_role');

create policy password_reset_events_service_select
  on public.password_reset_events
  for select
  using (auth.role() = 'service_role');

create policy password_reset_events_service_update
  on public.password_reset_events
  for update
  using (auth.role() = 'service_role');

create policy password_reset_events_service_delete
  on public.password_reset_events
  for delete
  using (auth.role() = 'service_role');

commit;
