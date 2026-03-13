# Copilot Instructions: Abonnementen koppelen aan PSP-betalingen

## Doel
Maak een interface + backend-flow waarmee gebruikers abonnementen (bijv. Netflix, Spotify, Google One) kunnen beheren en PSP-transacties (PayPal, Google Play, Apple, Klarna, etc.) aan die abonnementen kunnen koppelen.

Belangrijk: veel PSP-transacties bevatten niet direct de echte merchant in `counterparty`, dus matching moet ook op `details`, bedrag en terugkerend patroon kunnen werken.

## Scope (MVP)
- Nieuwe "Abonnementenbeheer"-pagina.
- CRUD voor abonnement-profielen.
- Matching-inbox met PSP-betalingen die nog niet gekoppeld zijn.
- Acties per transactie: `Koppel`, `Nieuw abonnement`, `Geen abonnement`.
- Eenvoudige suggestie-engine (rule + bedrag + frequentie).
- Koppeling zichtbaar op transactie-detail.

## Niet in scope (MVP)
- Volledige ML-pijplijn.
- Complexe regex-engine of externe provider-integraties.
- Multi-user autorisatie (gebruik bestaande `plan_key = "default"`-patroon).

## Architectuurkeuzes
- Gebruik `plan_key` zoals in budget-settings.
- Gebruik `normalizePattern()` uit `services/categorization-repository.ts`.
- Houd categorisatie en abonnement-matching naast elkaar; forceer categorie alleen na expliciete user-actie.

## 1) Database wijzigingen
Voeg een migratie toe:  
`supabase/migrations/20260405_add_subscription_matching_schema.sql`

Maak tabellen:

1. `subscription_profiles`
- `id uuid primary key default gen_random_uuid()`
- `plan_key text not null default 'default'`
- `name text not null`
- `normalized_name text not null`
- `billing_cycle text not null default 'monthly'`  
  check: `monthly|quarterly|yearly`
- `expected_amount numeric null`
- `amount_tolerance numeric not null default 2` (>= 0)
- `expected_day_of_month smallint null` (1..31)
- `provider_hint text null` (`paypal|google_play|apple|klarna|other`)
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Index/constraints:
- unique `(plan_key, normalized_name)`
- index op `(plan_key, is_active)`

2. `subscription_profile_rules`
- `id uuid primary key default gen_random_uuid()`
- `subscription_profile_id uuid not null references subscription_profiles(id) on delete cascade`
- `pattern text not null`
- `pattern_normalized text not null`
- `pattern_type text not null`  
  check: `counterparty_contains|details_contains`
- `weight integer not null default 50` (1..100)
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Index/constraints:
- unique `(subscription_profile_id, pattern_normalized, pattern_type)`
- index op `(pattern_normalized, pattern_type, is_active)`

3. `transaction_subscription_matches`
- `transaction_id uuid primary key references transactions(id) on delete cascade`
- `subscription_profile_id uuid null references subscription_profiles(id) on delete set null`
- `match_source text not null`  
  check: `manual|rule|heuristic|ignored`
- `confidence numeric null` (0..1)
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Index:
- index op `(subscription_profile_id)`
- index op `(match_source)`

## 2) Type-updates
Breid `types/categorization.ts` uit met:
- `SubscriptionBillingCycle`
- `SubscriptionProviderHint`
- `SubscriptionProfile`
- `SubscriptionProfileRule`
- `TransactionSubscriptionMatch`
- `SubscriptionSuggestion`
- `SubscriptionQueueItem`

Minimale velden in `SubscriptionQueueItem`:
- `transactionId`
- `date`
- `counterparty`
- `details`
- `amount`
- `providerDetected`
- `suggestions: SubscriptionSuggestion[]`

## 3) Repository/service laag
Maak nieuw bestand:  
`services/subscriptions.ts`

Implementeer:

1. Profile CRUD
- `listSubscriptionProfiles(planKey = "default")`
- `createSubscriptionProfile(input)`
- `updateSubscriptionProfile(id, input)`
- `setSubscriptionProfileActive(id, isActive)`
- `deleteSubscriptionProfile(id)`

2. Rules CRUD
- `listSubscriptionProfileRules(profileId)`
- `upsertSubscriptionProfileRule(input)`
- `deleteSubscriptionProfileRule(id)`

3. Match persist
- `upsertTransactionSubscriptionMatch(input)`
- `markTransactionAsNotSubscription(transactionId, notes?)`  
  (`match_source = "ignored"`, `subscription_profile_id = null`)
- `clearTransactionSubscriptionMatch(transactionId)`

4. Queue & suggesties
- `getSubscriptionQueue(monthStartIso, monthEndIso, planKey = "default")`
- Filter transacties:
  - `amount < 0`
  - providers in PSP-lijst of details bevatten PSP-hints
  - nog geen match in `transaction_subscription_matches`
- Retourneer sorted op datum desc.

## 4) Suggestie-engine (deterministisch, uitlegbaar)
In `services/subscriptions.ts`, maak `scoreSubscriptionSuggestion(tx, profile, rules, history)`.

Score-opbouw (0..1):
- Rule-match (`counterparty`/`details`) -> +0.50
- Name/alias in details -> +0.20
- Bedrag binnen tolerance -> +0.20
- Frequentie past bij profiel -> +0.10

Frequentie-check:
- monthly: ~25..35 dagen
- quarterly: ~80..100 dagen
- yearly: ~350..380 dagen

Confidence drempels:
- `>= 0.85`: "hoog" (autofill suggestie bovenaan)
- `0.65..0.84`: "middel"
- `< 0.65`: niet tonen

Belangrijk:
- Geen automatische definitieve koppeling zonder user-confirmatie in MVP.
- Bij meerdere kandidaten: sorteer desc op confidence.

## 5) UI: nieuwe pagina + bestaande schermen
### A. Nieuwe pagina
Maak nieuw scherm:  
`app/subscriptions.tsx`

UI-secties:
1. `Abonnementen`
- lijst profielen
- add/edit modal
- active toggle
- rules/aliases beheer (chips of simple text rows)

2. `Onbekende PSP-betalingen`
- queue uit `getSubscriptionQueue`
- per rij:
  - datum, bedrag, counterparty, korte subject uit `details`
  - top suggestie + confidence
  - knoppen:
    - `Koppel` (top suggestie)
    - `Kies abonnement`
    - `Nieuw abonnement`
    - `Geen abonnement`

### B. Navigatie
Werk `components/header-dropdown-menu.tsx` bij:
- Voeg menu-item toe: `Abonnementen` -> `/subscriptions`
- Update path-union type zodat `/subscriptions` geldig is.

### C. Budget-link
In `app/(tabs)/budget.tsx`:
- Voeg CTA toe in abonnement-sectie:
  - knop `Beheer abonnementen`
  - navigeert naar `/subscriptions`

### D. Transactie-detail hint
In `app/transaction-detail.tsx`:
- Als transactie PSP-achtig is en bedrag negatief:
  - toon kaart/banner: `Mogelijk abonnement`
  - knop `Koppel aan abonnement` opent selectie-modal.

## 6) Koppelingseffect in categorisatie
Bij handmatige koppeling in abonnementenflow:
- Optioneel toggle: `Zet categorie op abonnementen`.
- Als aan:
  - zoek geschikte subscription-category id in `categories` (key start met `subscriptions`)
  - gebruik bestaande `setTransactionManualCategory(...)`

Dit houdt gedrag consistent met bestaande categorisatie-audit.

## 7) Acceptatiecriteria
- Gebruiker kan abonnement-profielen CRUD’en.
- PSP-transacties zonder match komen in inbox.
- Gebruiker kan elke inbox-transactie koppelen, negeren of nieuw profiel maken.
- Na koppelen verdwijnt transactie uit inbox.
- Transactie-detail toont bestaande abonnementskoppeling.
- Geen regressie in bestaande budget/insights/categorisatie flows.

## 8) Testscenario’s
Test minimaal:
1. PayPal transactie met `details` die `NETFLIX` bevat -> hoge suggestie Netflix.
2. Google Play transactie met bedrag ~ Spotify -> middel/hoge suggestie Spotify.
3. Transactie gemarkeerd als `Geen abonnement` komt niet terug in inbox.
4. Handmatige koppeling + categorie-update zet categorie correct op abonnement.
5. Bestaande budgetberekening blijft laden zonder runtime errors.

## 9) Uitvoervorm voor Copilot
Werk in kleine commits per fase:
1. migratie + types
2. services/subscriptions.ts
3. app/subscriptions.tsx + menu routing
4. budget CTA + transaction-detail banner
5. polish + lint fixes

Geef na implementatie:
- lijst gewijzigde bestanden
- korte uitleg per bestand
- bekende risico’s / follow-ups
