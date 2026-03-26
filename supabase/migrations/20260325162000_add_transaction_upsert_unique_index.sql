-- Add a non-partial unique index so transaction upserts can use a stable conflict target.

begin;

create unique index if not exists transactions_user_account_dedupe_upsert_unique
  on public.transactions(user_id, bank_account_id, date, amount, details);

commit;
