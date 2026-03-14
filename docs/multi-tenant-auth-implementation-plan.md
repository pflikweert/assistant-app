# Gefaseerd implementatieplan: multi-tenant auth systeem

## Doel

De app veilig refactoren van single-user naar multi-tenant met:

- Supabase Auth voor login, registratie, sessies en wachtwoordflows
- harde tenant-isolatie op database-, service- en UI-niveau
- ondersteuning voor meerdere bankrekeningen per gebruiker
- CSV-import met verplichte rekeningcontext
- rules, budgetten, forecasting en subscriptions zonder cross-user leakage

Dit plan neemt de richting uit [`.github/copilot-auth-multi-tenant-instructions.md`](/Users/pieterflikweert/development/assistant/.github/copilot-auth-multi-tenant-instructions.md) over, maar scherpt de uitvoering aan op basis van de huidige codebase.

## Huidige uitgangssituatie

De codebase heeft al een eerste auth-basis, maar de app is functioneel nog single-user:

- sessiecontext bestaat al in [`app/_layout.tsx`](/Users/pieterflikweert/development/assistant/app/_layout.tsx), maar er is nog geen echte `AuthGate` die routes afdwingt
- login bestaat alleen als e-mail/wachtwoord scherm in [`app/login.tsx`](/Users/pieterflikweert/development/assistant/app/login.tsx)
- Supabase client gebruikt nog default storage in [`services/supabase.ts`](/Users/pieterflikweert/development/assistant/services/supabase.ts), niet `SecureStore`
- transacties worden nog zonder `user_id`-filter gelezen in [`screens/TransactionsScreen.tsx`](/Users/pieterflikweert/development/assistant/screens/TransactionsScreen.tsx)
- CSV import dedupet en updatet nog globaal op `date + details + amount` in [`screens/CSVImportScreen.tsx`](/Users/pieterflikweert/development/assistant/screens/CSVImportScreen.tsx)
- categorisatie-status en queue-state zijn nu app-globaal in [`services/categorization-status.ts`](/Users/pieterflikweert/development/assistant/services/categorization-status.ts)
- budgettabellen gebruiken nog `plan_key = 'default'` als globale sleutel in [`services/budget-plan-repository.ts`](/Users/pieterflikweert/development/assistant/services/budget-plan-repository.ts)

Er staan ook al eerste multi-tenant migrations, maar die zijn nog niet productierijp:

- [`supabase/migrations/20260413_add_user_id_to_main_tables.sql`](/Users/pieterflikweert/development/assistant/supabase/migrations/20260413_add_user_id_to_main_tables.sql) voegt nog niet alle benodigde `user_id`-kolommen toe en maakt ze niet `not null`
- [`supabase/migrations/20260413_enable_rls_and_policies.sql`](/Users/pieterflikweert/development/assistant/supabase/migrations/20260413_enable_rls_and_policies.sql) bevat een syntaxfout (`a lter`) en de policies zijn nog niet compleet genoeg voor veilige writes

## Randvoorwaarden

- Geen release naar productie voordat RLS + app-scoping + import-scoping samen actief zijn
- Geen enkele write-path mag vertrouwen op alleen client-state of alleen RLS
- Alle reset-, bulk- en background-processen moeten user-aware zijn voordat multi-user wordt aangezet
- Database-migraties moeten idempotent en rollback-bewust zijn

## Fase 0: Inventarisatie en veiligheidsnet

### Doel

De refactor beheersbaar maken zonder dat bestaande data of workflows onbedoeld beschadigd raken.

### Werkpakketten

- Maak een scope-inventaris van alle tabellen, services en schermen die `transactions`, `category_rules`, budgetten, forecasts en subscriptions aanraken
- Bevestig per tabel: `global`, `user-scoped` of `account-scoped`
- Voeg een release checklist toe voor auth, RLS, migraties, imports en logout lifecycle
- Zet testdata-strategie op voor ten minste twee gebruikers en twee rekeningen per gebruiker
- Definieer tijdelijke feature flags:
  - `AUTH_ENABLED`
  - `MULTI_ACCOUNT_IMPORT_ENABLED`
  - `USER_SCOPED_BACKGROUND_JOBS`

### Deliverables

- scope-matrix per tabel/proces
- rollout checklist
- testscenario’s voor tenant-isolatie

### Exit criteria

- we weten exact welke flows nog globaal zijn
- alle volgende fases kunnen per feature flag uitgerold worden

## Fase 1: Auth fundament en session boundary

### Doel

Van optionele login naar een echte authenticated app-shell.

### Werkpakketten

- Bouw echte auth-routes:
  - `/auth/login`
  - `/auth/register`
  - `/auth/forgot-password`
  - `/auth/reset-password`
- Vervang de huidige route-opzet door een echte `AuthGate` in de root layout
- Redirect zonder sessie altijd naar auth-stack
- Redirect met sessie altijd naar app-stack
- Voeg profiel-bootstrap toe na eerste login
- Maak sign-out volledig:
  - `supabase.auth.signOut()`
  - background jobs stoppen
  - in-memory status resetten
  - user-caches verwijderen
- Migreer Supabase auth storage naar `expo-secure-store`
- Voeg auth rate limiting en error handling toe op UI-niveau

### Betrokken code

- [`app/_layout.tsx`](/Users/pieterflikweert/development/assistant/app/_layout.tsx)
- [`app/login.tsx`](/Users/pieterflikweert/development/assistant/app/login.tsx)
- [`services/supabase.ts`](/Users/pieterflikweert/development/assistant/services/supabase.ts)

### Exit criteria

- anonieme gebruikers kunnen geen app-data routes meer gebruiken
- sessies blijven veilig persistent op device
- logout laat geen user-state achter

## Fase 2: Datamodel corrigeren voor tenancy

### Doel

Het schema veilig en consistent maken voordat businesslogica wordt omgebouwd.

### Werkpakketten

- Introduceer `bank_accounts`
- Voeg `user_id uuid not null references auth.users(id) on delete cascade` toe aan alle user-tabellen:
  - `transactions`
  - `categorization_audit`
  - `subscription_profiles`
  - `subscription_profile_rules` via join of direct scoping-strategie
  - `transaction_subscription_matches` impliciet via transaction ownership, maar liefst ook direct querybaar maken
  - `budget_plan_settings`
  - `budget_category_overrides`
  - `monthly_budget_values`
  - `forecast_income_sources`
  - `monthly_cashflow_forecasts`
- Voeg `bank_account_id` toe aan `transactions`
- Herbouw unieke indexen zodat ze tenant-safe zijn
- Refactor `category_rules` naar scope-model:
  - `scope = system | user | global_learned`
  - `user_id nullable`
  - scope-validatieconstraint
- Maak backfill-migraties voor bestaande rijen
- Voeg `updated_at` triggers of consistente update-paden toe waar nodig

### Aanbevolen migratievolgorde

1. Nieuwe kolommen nullable toevoegen
2. Backfill uitvoeren voor bestaande data
3. Nieuwe indexen en constraints toevoegen
4. Oude globale indexen verwijderen
5. Kolommen `not null` maken

### Betrokken code

- [`supabase/migrations`](/Users/pieterflikweert/development/assistant/supabase/migrations)
- [`README.md`](/Users/pieterflikweert/development/assistant/README.md)

### Exit criteria

- elke user-row heeft een eigenaar
- elke transactie heeft een bankrekening
- er bestaan geen globale uniqueness-regels meer die cross-user gedrag veroorzaken

## Fase 3: RLS als harde databasegrens

### Doel

Tenant-isolatie afdwingen op database-niveau.

### Werkpakketten

- Herstel en vervang de huidige RLS migration
- Activeer RLS op alle client-benaderbare user-tabellen
- Voeg per tabel `select/insert/update/delete` policies toe met `auth.uid() = user_id`
- Houd `categories` en systeemregels als expliciete uitzondering voor globale leesbaarheid
- Voeg write-policies toe met `with check (auth.uid() = user_id)`
- Voeg smoke tests toe voor:
  - user A kan user B niet lezen
  - user A kan user B niet updaten
  - user A kan user B niet deleten
  - system categories blijven leesbaar

### Niet doen

- Geen half-open policies zoals alleen `using (...)` zonder `with check (...)`
- Geen policies die schrijven op `user_id is null` toestaan voor user-tabellen

### Exit criteria

- database weigert alle cross-tenant reads en writes
- app werkt nog met normale anon-key en zonder service-role

## Fase 4: Service-laag tenant-safe maken

### Doel

Zorgen dat de applicatie logisch scoped werkt, ook los van RLS.

### Werkpakketten

- Introduceer een centrale helper voor `requireCurrentUser()`
- Voeg user-context toe aan alle repositories en services
- Vervang globale queries door expliciet gescopeerde queries
- Blokkeer bulk-acties zonder user-context
- Maak reset-operaties user-scoped en optioneel account-scoped

### Directe hotspots

- [`screens/TransactionsScreen.tsx`](/Users/pieterflikweert/development/assistant/screens/TransactionsScreen.tsx)
- [`services/categorization-repository.ts`](/Users/pieterflikweert/development/assistant/services/categorization-repository.ts)
- [`services/budget-plan-repository.ts`](/Users/pieterflikweert/development/assistant/services/budget-plan-repository.ts)

### Exit criteria

- geen repository leest of schrijft nog zonder user-scope
- globale deletes en recategorize-all zonder user-filter bestaan niet meer

## Fase 5: Multi-account import en rekeningbeheer

### Doel

Imports correct koppelen aan gebruiker en rekening.

### Werkpakketten

- Bouw rekeningselector en rekening-aanmaakflow voor import
- Parse rekeninginformatie uit CSV waar mogelijk
- Herken bestaande rekening op masked/hash van rekeningnummer
- Vereis vóór import:
  - account selectie of aanmaak
  - account type bevestiging
- Schrijf per transactie:
  - `user_id`
  - `bank_account_id`
- Vervang dedupe door account-scoped identiteit, bijvoorbeeld:
  - `user_id + bank_account_id + date + amount + normalized_details + source_hash`
- Verwijder overbodige PII uit `metadata`
- Voeg size/type-validatie en parsefout-rapportage toe

### Betrokken code

- [`screens/CSVImportScreen.tsx`](/Users/pieterflikweert/development/assistant/screens/CSVImportScreen.tsx)

### Exit criteria

- een import kan nooit transacties van een andere gebruiker of rekening raken
- toekomstige imports kunnen rekeningmapping automatisch hergebruiken

## Fase 6: Background jobs, categorisatie en rules engine isoleren

### Doel

Alle automatische verwerking session-, user- en waar nodig account-aware maken.

### Werkpakketten

- Maak categorisatiequeue user-aware
- Segmenteer status-store per sessie of user
- Segmenteer lokale caches en OpenAI categorisatiecache per user
- Laat `runPendingCategorizationInBackground` alleen transacties van huidige user ophalen
- Maak `recategorize-all` user-scoped
- Schrijf handmatige correcties naar `user` rules
- Lees regels in prioriteit:
  - user
  - system
  - model fallback
- Verbied globaal leren op basis van ruwe user-data

### Betrokken code

- [`services/categorization-status.ts`](/Users/pieterflikweert/development/assistant/services/categorization-status.ts)
- [`services/categorization-repository.ts`](/Users/pieterflikweert/development/assistant/services/categorization-repository.ts)

### Exit criteria

- geen background worker of cache lekt nog status of data tussen gebruikers
- rule learning blijft persoonlijk tenzij geaggregeerd en expliciet veilig

## Fase 7: Budgetten, forecasts en subscriptions user-scopen

### Doel

Alle afgeleide financiële domeinen correct aan de eigenaar koppelen.

### Werkpakketten

- Vervang `plan_key = 'default'` als globale identiteit door `user_id + plan_key`
- Maak uniqueness user-scoped in budgettabellen
- Maak forecast conflicts user-scoped:
  - `forecast_income_sources`
  - `monthly_cashflow_forecasts`
- Maak subscriptions user-scoped:
  - profielen
  - rules
  - matches
- Zorg dat dashboards, insights en budget widgets alleen user-data lezen

### Directe hotspots

- [`services/budget-plan-repository.ts`](/Users/pieterflikweert/development/assistant/services/budget-plan-repository.ts)
- budget-, insights- en subscription-schermen in [`app`](/Users/pieterflikweert/development/assistant/app)

### Exit criteria

- budget recalculatie, forecasts en subscriptions zijn veilig per gebruiker
- geen `onConflict` meer op alleen globale sleutels zoals `month_start`

## Fase 8: Onboarding, UX en operationele afronding

### Doel

De nieuwe architectuur bruikbaar en uitlegbaar maken voor echte gebruikers.

### Werkpakketten

- Voeg onboarding toe na eerste login:
  - profiel initialiseren
  - eerste rekening aanmaken
  - optioneel CSV importeren
- Voeg accountfilter toe op transacties, insights en budgetcontext
- Werk settings om naar echte profiel- en accountdata
- Documenteer beheerflows en scripts met expliciete user-scope parameters
- Voeg monitoring toe voor auth errors, RLS-fouten en import failures

### Exit criteria

- eerste gebruiker kan end-to-end onboarden zonder handmatige database-stappen
- beheer- en supportflows zijn tenant-safe

## Teststrategie per fase

- Unit tests voor helpers die scoping opbouwen
- Repository-tests tegen Supabase voor user A versus user B
- Import tests voor dedupe binnen dezelfde rekening en isolatie tussen rekeningen
- Regression tests voor:
  - reset transacties
  - recategorize all
  - budget recompute
  - subscription matching
  - logout cleanup
- Handmatige acceptatietest met:
  - gebruiker A, rekening betaal + spaar
  - gebruiker B, rekening betaal
  - overlappende merchants en bedragen

## Aanbevolen uitvoerorde

1. Fase 0 en 1 meteen oppakken
2. Daarna Fase 2 en 3 als harde databasebasis
3. Vervolgens Fase 4 en 5 zodat reads/writes veilig worden
4. Daarna Fase 6 en 7 voor afgeleide processen
5. Fase 8 als productisatie en rollout-afronding

## Concrete eerste sprint

Als we dit pragmatisch in de eerstvolgende sprint willen neerzetten, is dit de beste eerste slice:

1. AuthGate + auth routes + secure session storage
2. Nieuwe migraties voor `bank_accounts`, `transactions.user_id`, `transactions.bank_account_id`
3. RLS correct activeren op `transactions`, `budget_*`, `monthly_budget_values`
4. CSV import refactoren naar user/account-scoped writes
5. Transaction list en reset/categorize paden user-scopen

Dat levert meteen de grootste risicoreductie op, zonder eerst elk budget- of forecastingpad volledig te hoeven afronden.

## Open aandachtspunten

- Beslis of `categories` puur systeem + optioneel user-override blijft, of dat user categories echt een productfeature worden
- Beslis of `transaction_subscription_matches` alleen impliciet via `transaction_id` scoped blijft of ook direct `user_id` krijgt voor eenvoudiger queries
- Plan MFA als fase 1.5 of fase 8, afhankelijk van release-urgentie
- Als compliance-eisen toenemen, schuift veldniveau-encryptie naar voren van fase 2/3 naar MVP
