-- Migration: create transactions table
-- Run this using the Supabase CLI (e.g. `supabase db push` or `supabase migration new`)

/*
  Schema mirrors the shape expected by the import screen.
  A unique index on (date, description, amount) prevents exact duplicates.
*/

create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  description text not null,
  counterparty text,
  amount numeric not null,
  currency text,
  type text,
  created_at timestamp with time zone default now()
);

create unique index if not exists transactions_unique
  on public.transactions (date, description, amount);
