-- Safe-only performance migration: add covering indexes for foreign keys.
-- No index removals in this release.

create index if not exists categorization_audit_new_category_id_idx
  on public.categorization_audit(new_category_id);

create index if not exists categorization_audit_previous_category_id_idx
  on public.categorization_audit(previous_category_id);

create index if not exists forecast_income_sources_reference_category_id_idx
  on public.forecast_income_sources(reference_category_id);

create index if not exists forecast_income_sources_reference_transaction_id_idx
  on public.forecast_income_sources(reference_transaction_id);

create index if not exists transactions_bank_account_owner_fk_cover_idx
  on public.transactions(bank_account_id, user_id);

