# Copilot Instructions: Auth + Multi-user + Multi-account refactor

## Doel

Refactor de app van single-user naar veilig multi-user, inclusief:

- login, logout, registratie en sessiebeheer
- strikte data-isolatie per gebruiker
- ondersteuning voor meerdere bankrekeningen per gebruiker
- CSV-import met expliciete rekeningcontext (betaal/spaar/etc.)
- rules-engine die zowel user-specifiek leert als globale signalen kan gebruiken zonder data leakage

Werk gefaseerd. Deze refactor raakt vrijwel alle databronnen en schermen.

## Onderzoeksconclusies (richtinggevend)

- Gebruik Supabase Auth + RLS als primaire beveiligingslaag op database-niveau.
- Gebruik pooled multi-tenant (`user_id` in gedeelde tabellen) als eerste stap; houd ontwerp uitbreidbaar naar complexere tenancy.
- Modelleer bankrekeningen expliciet (`bank_accounts`) en koppel transacties hieraan.
- Houd regels in twee lagen:
  - `system`: globale baseline-regels
  - `user`: persoonlijke regels/voorkeuren
- Dedupe mag nooit globaal zijn; altijd tenant + account scoped.

## Security (niet onderhandelbaar)

1. Activeer RLS op elke client-benaderbare user-data tabel.
2. Voeg `user_id uuid not null references auth.users(id) on delete cascade` toe op user-tabellen.
3. Policies: `auth.uid() = user_id` op `select/insert/update/delete`.
4. Forceer scoping in code (niet alleen vertrouwen op RLS).
5. Nooit service-role key in de app client.
6. Auth rate limits harden (signup/login/password reset).
7. Voeg MFA-ondersteuning toe (iteratief, minimaal opt-in TOTP).
8. Sla sessies veilig op in React Native (SecureStore-gebaseerde storage adapter).
9. Harden CSV import (size/type checks, parse-fout afhandeling, defensieve mapping).

## Privacy & encryptie (MVP-besluit)

Voor MVP:
1. Verplicht: encryptie in transit (TLS) en encryptie at rest op platformniveau.
2. Verplicht: dataminimalisatie. Sla alleen op wat functioneel nodig is.
3. Verplicht: gevoelige identifiers pseudonimiseren waar mogelijk (bijv. IBAN/accountnummer masked + hash voor matching).
4. Verplicht: voorkom dat ruwe CSV-PII onnodig in `metadata` blijft staan.

Nog niet verplicht voor MVP (wel plannen voor fase 2):
1. Volledige kolom-level encryptie van transactievelden in Postgres.
2. Eigen key-management/KMS-rotatie voor app-level encryptiesleutels.

Wanneer wel direct meenemen in MVP:
- als je expliciet compliance-eisen hebt (bijv. contractueel/beleid) die veldniveau-encryptie eisen.

## Datamodelstrategie

### Gedeelde tabellen (global)

- `categories` (systeemtaxonomie)
- systeemregels in `category_rules` (`scope = 'system'`)

### User-specifieke tabellen

- `transactions`
- `categorization_audit`
- `subscription_profiles`
- `subscription_profile_rules`
- `transaction_subscription_matches`
- `budget_plan_settings`
- `budget_category_overrides`
- `monthly_budget_values`
- `forecast_income_sources`
- `monthly_cashflow_forecasts`

### Nieuwe tabel

- `bank_accounts`
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `name text not null`
  - `account_type text not null` (`checking|savings|credit|loan|investment|cash|other`)
  - `account_subtype text null`
  - `provider text null` (bijv. `rabobank_csv`)
  - `currency text not null default 'EUR'`
  - `is_active boolean not null default true`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`

### Bestaande tabellen aanpassen

1. `transactions`

- `user_id` toevoegen
- `bank_account_id` toevoegen
- unieke index vervangen door tenant/account-veilige index (bijv. `(user_id, bank_account_id, date, amount, details)`)

2. Alle user-tabellen hierboven

- `user_id` toevoegen
- relevante unieke indexen uitbreiden met `user_id`

3. `category_rules`

- voeg `scope text not null default 'system'` toe (`system|user|global_learned`)
- voeg `user_id uuid null` toe
- constraint: bij `scope='user'` moet `user_id` gezet zijn
- unieke constraints splitsen op scope:
  - system: uniek op `(scope, pattern_normalized, pattern_type)`
  - user: uniek op `(user_id, pattern_normalized, pattern_type)`

## App-architectuur

### Auth

- Maak auth-routes:
  - `/auth/login`
  - `/auth/register`
  - `/auth/forgot-password`
  - `/auth/reset-password`
- Voeg `AuthGate` toe in root layout:
  - zonder sessie -> auth stack
  - met sessie -> app stack
- Vervang hardcoded profieldata in `settings` door echte user data.
- Koppel bestaande Sign out knop aan echte `supabase.auth.signOut()`.

### Onboarding

- Na eerste login:
  1. profiel initialiseren
  2. eerste rekening aanmaken
  3. optioneel direct CSV import

### Multi-account UX

- Import-flow moet verplicht rekening kiezen of aanmaken.
- Vraag expliciet: betaalrekening/spaarrekening/anders.
- Voeg accountfilter toe op transactielijst en insights/budget context waar relevant.
- houd rekening met rekening nummer van de gebruiker, deze staat in de csv upload, deze kun je gebruiker om rekening aan te maken en te herkennen bij toekomstige rekeningen uploads. indien bestaat gaat de mapping vanzelf automatisch.

## CSV import refactor

1. Voeg stap toe vóór `doImport`:

- Select account of create account
- Bevestig `account_type`

2. Iedere geïmporteerde transactie krijgt:

- `user_id = currentUser.id`
- `bank_account_id = selectedAccount.id`

3. Dedupe aanpassen:

- Niet meer globaal `date+details+amount`
- Altijd scoped op `user_id + bank_account_id` (en liefst extra bronveld/hash)

## Proces-scope matrix (verplicht user-specifiek)

Gebruik deze matrix als harde scope-regel tijdens refactor:

1. Herberekenen budgetten
- Status: nu niet veilig user-specifiek.
- Huidig risico:
  - `planKey: "default"` wordt overal hergebruikt.
  - forecast upsert gebruikt `onConflict: "month_start"` (globaal per maand).
- Vereiste doeltoestand:
  - budget-tabellen op `user_id` scopen.
  - forecast-tabellen op `(user_id, month_start)` scopen.
  - alle recompute calls moeten user-context (en waar nodig account-context) meenemen.

2. Alles hercategoriseren
- Status: nu niet veilig user-specifiek.
- Huidig risico:
  - recategorize-all leest alle transaction IDs zonder user filter.
- Vereiste doeltoestand:
  - alleen transacties van ingelogde user in queue.
  - job-status ook per user/session isoleren.

3. Transacties resetten
- Status: nu niet veilig user-specifiek.
- Huidig risico:
  - reset verwijdert alle transacties (globale delete).
- Vereiste doeltoestand:
  - reset op user scope (optioneel extra account scope).
  - afgeleide data van dezelfde user mee verwijderen/resetten (analysis, forecasts, matches, audit, budget cache).

## Overige processen die ook user-specifiek moeten worden

1. Background sweep bij app-start
- `runPendingCategorizationInBackground` moet alleen pending rows van huidige user oppakken.

2. Background queue + status + cache
- in-memory queue (`queuedTransactionIds`) en status-store zijn nu globaal.
- maak dit session/user aware.
- OpenAI categorisatiecache in localStorage moet user-gesegmenteerde key gebruiken.

3. Forecasting en income-sources
- `forecast_income_sources` gebruikt nu globale `source_key` conflict.
- `monthly_cashflow_forecasts` gebruikt nu globale `month_start` conflict.
- beide moeten naar user-keyed uniqueness.

4. Budget instellingen en maandwaarden
- `budget_plan_settings`, `budget_category_overrides`, `monthly_budget_values` gebruiken nu `plan_key='default'`.
- voeg `user_id` toe en maak unieke constraints user-scoped.

5. Subscriptions
- subscription-profielen/rules draaien nu op `plan_key='default'`.
- queue/selecties moeten user_id-filter krijgen.
- transactiematches moeten impliciet user-geïsoleerd blijven via transaction ownership.

6. Bulk/manual categorisatie-acties
- counterparty-bulk updates, manual set category, reviewed/budget-excluded toggles altijd met user-check uitvoeren.

7. CSV import upsert/update pad
- bestaande “find existing transaction” lookup moet user+account scoped.
- update pad mag nooit row van andere user raken.

8. Dashboard/insights widgets
- alle transaction/forecast/budget queries in dashboard, insights en budget tabs user-scopen.

9. Logout lifecycle
- bij logout: background jobs stoppen, queue/status resetten, user-specifieke local caches opruimen.

10. Beheer/scripts
- interne scripts (backfill/check/recompute) moeten user-scope parameters ondersteunen en niet impliciet global uitvoeren.

## Rules engine strategie (veilig + schaalbaar)

1. Classificatievolgorde:

- user-regels (hoogste prioriteit)
- system-regels
- model/heuristiek fallback

2. Learning:

- handmatige correcties schrijven naar user-regels
- globale verbetering alleen via geaggregeerde/anonieme signalen
- nooit raw user-transactiegegevens direct delen tussen gebruikers

3. Transparantie:

- sla bron op (`manual|user_rule|system_rule|model`)
- houd auditspoor per wijziging

## Migratievolgorde (verplicht)

1. Nieuwe tabellen/kolommen toevoegen als nullable waar nodig.
2. Backfill script draaien:

- bestaande data koppelen aan gekozen eigenaar
- default `bank_account` creëren
- transacties daaraan koppelen

3. RLS policies aanzetten en valideren.
4. `NOT NULL` + nieuwe unieke indexen afdwingen.
5. Oude single-user aannames en indexen verwijderen.

## Te wijzigen codegebieden

- `services/supabase.ts` (auth/session storage setup)
- `app/_layout.tsx` (auth gate + routing split)
- `app/(tabs)/settings.tsx` (profiel + echte logout)
- `screens/CSVImportScreen.tsx` (accountselectie + scoped import)
- `app/(tabs)/transactions.tsx` en detail-schermen (accountcontext)
- `services/categorization-repository.ts` (tenant-scoped queries)
- `services/categorization.ts` (tenant-scoped achtergrondjobs)
- `services/analysis.ts`
- `services/forecasting.ts`
- `services/budget-plan-repository.ts` en `services/budget-plan.ts`
- `services/subscriptions.ts`
- `types/categorization.ts` (nieuwe account/user types)
- `supabase/migrations/*.sql` (nieuwe auth/multi-tenant migraties)

## Acceptatiecriteria

- Auth flows werken stabiel op iOS/Android/web.
- via urls kun je nooit bij data van andere gebruikers komen
- User A kan nooit data van User B lezen/schrijven (RLS bewezen).
- Eén gebruiker kan meerdere accounts aanmaken en gebruiken.
- CSV import vereist accountcontext en schrijft correct per account.
- Budget/insights/subscriptions blijven werken per user zonder regressie.
- Herberekenen budgetten, alles hercategoriseren en transacties resetten werken strikt binnen user-scope.
- Rules engine ondersteunt system + user regels zonder cross-user leakage.

## Uitvoervorm voor Copilot (commitvolgorde)

1. Auth basis + route bescherming
2. DB migraties (accounts + user_id + RLS)
3. Repository/service tenant-scoping
4. CSV import + account UX
5. Rules engine scopes
6. Hardening + tests + cleanup

## Externe referenties voor ontwerpkeuzes

- Supabase Auth architecture: https://supabase.com/docs/guides/auth/architecture
- Supabase securing your API / RLS: https://supabase.com/docs/guides/api/securing-your-api
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase React Native Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/react-native
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
- Plaid Accounts API (type/subtype model): https://plaid.com/docs/api/accounts/
- Plaid Transactions Sync (incremental sync patroon): https://plaid.com/docs/transactions/sync-migration/
- Stripe Radar rules + modelgestuurde aanpak: https://docs.stripe.com/radar/rules
- AWS SaaS multitenancy patterns (pool/bridge/silo): https://docs.aws.amazon.com/whitepapers/latest/multi-tenant-saas-storage-strategies/multitenancy-on-rds.html
