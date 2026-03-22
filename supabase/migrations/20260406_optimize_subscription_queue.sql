begin;
create index if not exists subscription_profile_rules_profile_active_weight_idx
  on public.subscription_profile_rules(subscription_profile_id, is_active, weight desc, pattern);
create index if not exists transaction_subscription_matches_profile_not_ignored_idx
  on public.transaction_subscription_matches(subscription_profile_id, transaction_id)
  where match_source <> 'ignored';
create index if not exists transactions_negative_date_idx
  on public.transactions(date desc)
  where amount < 0;
commit;
