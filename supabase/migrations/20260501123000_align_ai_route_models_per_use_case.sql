begin;

-- Stem AI-routemodellen per use case af op de huidige productkeuze.
-- Laat expliciet afwijkende modellen ongemoeid.

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
  ('help_general', 'gpt-5.4-nano', 'chat', 0.20, 800, true, 'text'),
  ('help_spending_advice', 'gpt-5.4-mini', 'chat', 0.20, 800, true, 'json_object'),
  ('help_transactions_insight', 'gpt-5.4-nano', 'chat', 0.20, 800, true, 'text'),
  ('help_category_insight', 'gpt-5.4-nano', 'chat', 0.20, 800, true, 'text'),
  ('budget_coach', 'gpt-5.4-mini', 'analysis', 0.20, 900, true, 'json_schema'),
  ('transaction_categorization', 'gpt-5.4-nano', 'classification', 0.00, 700, true, 'json_schema'),
  ('import_pdf_mapping', 'gpt-5.4-mini', 'extraction', 0.00, 1600, true, 'json_object')
on conflict (use_case) do update
set model = excluded.model
where public.ai_route_settings.model in ('gpt-4.1-mini', 'gpt-5.4-nano');

commit;
