-- Migration: make transactions schema generic and add metadata storage

-- rename `description` to `details` only if the old column exists
DO $$
BEGIN
  IF EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name='transactions'
      AND column_name='description'
  ) THEN
    ALTER TABLE public.transactions RENAME COLUMN description TO details;
  END IF;
END
$$;
-- add more generic columns and metadata jsonb (idempotent)
alter table public.transactions
  add column if not exists counterparty text;
alter table public.transactions
  add column if not exists currency text;
alter table public.transactions
  add column if not exists type text;
alter table public.transactions
  add column if not exists metadata jsonb;
-- the unique index on (date,details,amount) still serves to prevent duplicates
-- but details may now be longer if constructed from multiple fields;
