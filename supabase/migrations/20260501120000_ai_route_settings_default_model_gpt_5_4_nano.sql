begin;

-- Zet legacy standaardmodellen voor AI-routes van gpt-4.1-mini naar gpt-5.4-nano.
-- Laat andere handmatig gekozen modellen ongemoeid.

update public.ai_route_settings
set model = 'gpt-5.4-nano'
where model = 'gpt-4.1-mini'
  and use_case in (
    'help_general',
    'help_spending_advice',
    'help_transactions_insight',
    'help_category_insight',
    'budget_coach',
    'transaction_categorization',
    'import_pdf_mapping'
  );

commit;
