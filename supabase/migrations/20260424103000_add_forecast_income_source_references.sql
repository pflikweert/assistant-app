begin;

alter table public.forecast_income_sources
  add column if not exists reference_transaction_id uuid null references public.transactions(id) on delete set null,
  add column if not exists reference_category_id uuid null references public.categories(id) on delete set null,
  add column if not exists reference_category_path text null,
  add column if not exists reference_label text null,
  add column if not exists reference_source_type text null;

alter table public.forecast_income_sources
  drop constraint if exists forecast_income_sources_reference_source_type_check;

alter table public.forecast_income_sources
  add constraint forecast_income_sources_reference_source_type_check
    check (
      reference_source_type is null or reference_source_type in (
        'transaction',
        'derived'
      )
    );

commit;

