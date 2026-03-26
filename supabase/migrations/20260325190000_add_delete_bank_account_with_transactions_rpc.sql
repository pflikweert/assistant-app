create or replace function public.delete_bank_account_with_transactions(
  target_bank_account_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := (select auth.uid());
  deleted_transaction_count integer := 0;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.bank_accounts
    where id = target_bank_account_id
      and user_id = current_user_id
  ) then
    raise exception 'Bankrekening niet gevonden.';
  end if;

  select count(*)::integer
  into deleted_transaction_count
  from public.transactions
  where user_id = current_user_id
    and bank_account_id = target_bank_account_id;

  delete from public.transactions
  where user_id = current_user_id
    and bank_account_id = target_bank_account_id;

  delete from public.bank_accounts
  where id = target_bank_account_id
    and user_id = current_user_id;

  return deleted_transaction_count;
end;
$$;

grant execute on function public.delete_bank_account_with_transactions(uuid) to authenticated;
