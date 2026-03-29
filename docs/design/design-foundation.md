# Design Foundation

Deze design foundation is afgeleid uit de huidige Budio-codebase. De code is hier de source of truth. Dit document beschrijft daarom niet het ideale systeem los van de app, maar de herbruikbare ontwerpgrondslag die nu al zichtbaar is in de actieve product-UI.

## Scope

- Primaire bron:
  - `Dashboard`
  - `Transactions`
  - `Budget`
  - `Insights`
  - `Settings`
  - utility-flows eromheen zoals `Bankrekeningen`, `Transaction Detail` en `Subscriptions`
- Buiten primaire foundation:
  - `auth`
  - `admin`
  - `help-assistant`
  - legacy-routes zoals `insights-legacy`
- Deze families mogen wel worden genoemd als uitzondering of legacy, maar vormen niet de canonieke basis voor nieuwe product-UI.

## Classificatie

- `canoniek`: gedeeld, actief en herbruikbaar patroon dat als standaard moet gelden
- `in gebruik`: bestaand patroon dat productmatig relevant is, maar nog niet stabiel of breed genoeg is om als echte standaard te gelden
- `legacy`: inconsistent, route-specifiek of ouder patroon dat niet verder gekopieerd moet worden

## Fundament

### 1. Rust eerst

- De app gebruikt een lichte, zachte basis met veel ademruimte.
- Primaire informatie staat centraal:
  - huidige stand
  - beschikbare ruimte
  - trend of risico
  - advies of vervolgstap
- Visuele nadruk komt vooral uit:
  - oppervlak
  - spacing
  - typografische hiërarchie
  - beperkte accentkleur

### 2. Shell bepaalt ritme

- Shell-gedrag is in Budio een gedeeld systeem, geen schermspecifieke styling.
- Canonieke shell-laag:
  - `FinanceDashboardHeader`
  - `FinanceTopBar`
  - `FinanceHeroShell`
  - `FinanceDetailShell`
  - `FinanceUtilityShell`
  - `FinanceBottomSheetShell`
  - `FinanceScreenBackdrop`
- Nieuwe schermen moeten starten vanuit de juiste shell-keuze, niet vanuit losse layout-stijlen.

### 3. UI presenteert, services bepalen

- Financiële betekenis komt uit services en dataflows, niet uit schermcomponenten.
- Design-documentatie moet dus alleen presentatiepatronen standaardiseren, niet de onderliggende financiële waarheid herschrijven.

### 4. Mobile-first met gecentreerde contentkolom

- Hoofdschermen gebruiken full-bleed achtergrond of hero, maar inhoud blijft in een gecentreerde contentkolom met vaste `maxWidth`.
- Dit patroon is zichtbaar in de gedeelde shells en terugkerend in de actieve hoofdschermen.

### 5. Accentkleur is functioneel, niet decoratief

- Geel is in de product-UI een functioneel accent voor focus, CTA en waarschuwing.
- Basis van de app blijft licht, rustig en grotendeels neutraal.

## Canonieke basis

### Canonieke tokens en primitives

- `constants/theme.ts` is de primaire tokenbron.
- `FinTokens` is canoniek voor:
  - kleur
  - spacing
  - radius
  - typography
  - fontWeight
  - icon
- `FinSurfaces` is canoniek voor de twee gedeelde hoofdoppervlakken:
  - `topLevelCard`
  - `mainPageTintedCard`

### Canonieke gedeelde UI-basis

- Tekst:
  - `FinanceText` is de bedoelde tekstprimitive
- CTA/interactie:
  - `FinanceButton`
  - `FinancePressableSurface`
- Structuur:
  - `FinanceSectionHeader`
  - `FinanceDetailCard`
  - `FinanceTextBlock`
- Status/signaal:
  - `FinanceInlineCallout`
  - `FinanceStatusChip`
- Selectie:
  - `FinanceMonthSelector`
  - `FinanceMonthSelectorModal`
  - `FinanceScopeSwitch`

## Top 10 componenten die gestandaardiseerd moeten worden

1. Topbar/header-familie:
   - `FinanceTopBar`
   - `FinanceDetailTopBar`
   - `FinanceModalTopBar`
2. Shell/hero-familie:
   - `FinanceDashboardHeader`
   - `FinanceHeroShell`
   - `FinanceDetailShell`
   - `FinanceUtilityShell`
3. Button/CTA-patroon:
   - `FinanceButton` versus losse `TouchableOpacity` en route-specifieke `Pressable`-knoppen
4. Input/form-field patroon:
   - losse `TextInput`-stijlen in `auth`, `budget`, `subscriptions`, `transactions`, `bank-account-form`
5. Chip/filter/segment patroon:
   - `FinanceStatusChip`
   - filterchips
   - `FinanceScopeSwitch`
   - selector-badges
6. Card-familie:
   - balance
   - budget
   - insight
   - warning
7. List-row patroon:
   - `TransactionListRow`
   - `FinanceSettingsRow`
   - category/account/subscription rows
8. Modal/bottom-sheet patroon:
   - `FinanceBottomSheetShell` versus losse `Modal`-implementaties
9. Empty-state patroon:
   - huidige empty states zijn inhoudelijk sterk, maar visueel nog onvoldoende gedeeld
10. Quick action / docked action pattern:
   - `FinanceQuickMenu`
   - header actions
   - vaste sheet footers

## Belangrijkste inconsistenties in de UI

- Veel ruwe kleur- en `rgba`-literals buiten tokens
- Lage adoptie van `FinanceText`
- Veel losse `TouchableOpacity`- en `TextInput`-patronen
- Meerdere bijna-gelijke header/topbar-varianten
- Gemengde kaartstijlen tussen dashboard, insights, budget, auth en utility flows
- Utility-schermen met custom modals naast de gedeelde `FinanceBottomSheetShell`
- Koele `FinanceScreenBackdrop` naast het warmere basispalet uit `theme.ts`
- Forecast- en insight-cards met eigen donkere stijl buiten het algemene card-contract
- `auth`, `admin` en speciale flows met deels afwijkende visuele taal
- Legacy-routes en oudere schermen met een eigen stylingpad

## Legacy en inconsistenties

### Legacy UI-debt die zichtbaar is in de codebase

- Ruwe hex- en rgba-kleuren komen op veel plekken nog direct voor in `app/`, `components/` en `screens/`.
- De design-governance-bestanden bevestigen dit:
  - `docs/design/style-literals-baseline.json`
  - `docs/design/forbidden-hex-baseline.json`
- Er bestaan meerdere productoppervlakken met eigen visual language:
  - donkere forecast-card
  - lichtere utility-cards
  - auth-specifieke input- en helperblokken
  - oudere modals in `budget`, `settings`, `subscriptions` en `transaction-detail`

### Wat we niet als standaard verheffen

- Route-specifieke modalcards gebouwd met losse `Modal`
- Schermspecifieke `TextInput`-stijlen
- Schermspecifieke `TouchableOpacity`-knoppen
- Ruwe kleurwaarden die niet uit tokens komen
- Legacy en special-case schermen als basis voor nieuwe product-UI

## Richting voor AI en developers

- Gebruik eerst de gedeelde shell en componentfamilie die al bestaat.
- Kopieer geen schermspecifieke stijl als er al een vergelijkbaar gedeeld patroon is.
- Als een patroon op meerdere schermen terugkomt maar nog niet goed gedeeld is, behandel het als `in gebruik` en centraliseer het in een vervolgwijziging.
- Als een patroon duidelijk afwijkt van de actieve finance-hoofdschermen, markeer het als `legacy` in plaats van het stilzwijgend te normaliseren.

## Huidige status per laag

### Canoniek

- tokens uit `constants/theme.ts`
- hoofdscherm-shells
- detail- en utility-shells
- month selector-familie
- quick menu als productnavigatiepatroon
- settings-row/group patroon

### In gebruik

- dashboard cards
- budget cards
- insight cards
- category sheet-keuzecomponenten
- account- en subscription beheerkaarten
- empty states

### Legacy

- custom modals naast `FinanceBottomSheetShell`
- losse form/input-systemen
- route-specifieke CTA-styling
- schermen met ruwe literals als impliciete tokens
- auth/admin/help-assistant als afwijkende visuele families
