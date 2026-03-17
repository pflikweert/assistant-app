begin;

create index if not exists transactions_user_date_desc_idx
  on public.transactions(user_id, date desc)
  where user_id is not null;

create index if not exists transactions_user_counterparty_date_desc_idx
  on public.transactions(user_id, counterparty, date desc)
  where user_id is not null and counterparty is not null;

create index if not exists transactions_user_month_start_idx
  on public.transactions(
    user_id,
    ((date_trunc('month', date::timestamp without time zone))::date) desc
  )
  where user_id is not null;

create index if not exists transactions_user_counterparty_month_start_idx
  on public.transactions(
    user_id,
    counterparty,
    ((date_trunc('month', date::timestamp without time zone))::date) desc
  )
  where user_id is not null and counterparty is not null;

drop function if exists public.list_transaction_months(text);

create or replace function public.list_transaction_months(
  p_counterparty text default null
)
returns table (
  month_start date,
  transaction_count bigint
)
language sql
security invoker
set search_path = public
as $$
  select
    (date_trunc('month', t.date::timestamp without time zone))::date as month_start,
    count(*)::bigint as transaction_count
  from public.transactions t
  where t.user_id = auth.uid()
    and (p_counterparty is null or t.counterparty = p_counterparty)
  group by 1
  order by 1 desc
$$;

grant execute on function public.list_transaction_months(text) to authenticated;

commit;
