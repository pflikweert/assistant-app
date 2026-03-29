# Component Inventory

Deze inventaris beschrijft de herbruikbare componentfamilies die zichtbaar zijn in de huidige product-UI. Per familie benoemen we wat canoniek is, wat in gebruik is en wat legacy blijft.

## Statuslabels

- `canoniek`: standaard voor nieuwe product-UI
- `in gebruik`: relevant bestaand patroon, maar nog niet volledig geconsolideerd
- `legacy`: niet verder uitbreiden of kopieren als er een gedeeld alternatief bestaat

## Buttons

### Canoniek

- `FinanceButton`
  - varianten:
    - `primary`
    - `secondary`
    - `ghost`
    - `danger`
    - `icon`
  - sizes:
    - `sm`
    - `md`
    - `lg`

### In gebruik

- `FinanceCircleIconButton`
- vaste sheet/footer-acties binnen `FinanceBottomSheetShell`
- quick action knoppen in hoofdschermen

### Legacy

- losse `TouchableOpacity`-CTA’s in schermen
- route-specifieke `Pressable`-buttons met eigen kleuren, radius en tekststijl

### Gebruik

- Gebruik `FinanceButton` voor nieuwe primaire en secundaire acties.
- Gebruik geen nieuwe schermspecifieke CTA-stijlen als `FinanceButton` voldoende is.

## Inputs

### Canoniek

- Er is nog geen volwaardige gedeelde finance input-component.
- Formeel canoniek is alleen het token- en kleurcontract uit `constants/theme.ts`.

### In gebruik

- `TextInput`-velden in:
  - `auth`
  - `transactions`
  - `budget`
  - `subscriptions`
  - `bank-account-form`

### Legacy

- route-specifieke inputstijlen met eigen placeholderkleur, border en padding
- meerdere bijna-gelijke formulierpatronen zonder gedeelde component

### Gebruik

- Nieuwe inputs moeten niet nog een zesde stijlpad introduceren.
- Tot een gedeelde inputcomponent bestaat, hergebruik de rustigste bestaande finance inputstijl en houd afwijkingen minimaal.

## Chips en filters

### Canoniek

- `FinanceStatusChip`
- `FinanceMonthSelector`
- `FinanceMonthSelectorModal`

### In gebruik

- `FinanceScopeSwitch`
- filterchips in `Transactions`
- actieve filterchips en selector-badges

### Legacy

- schermspecifieke filterchips met ruwe kleuren
- segmenten die hun eigen track, pill of type-ritme meenemen

### Gebruik

- Gebruik bestaande selector- en chipcomponenten eerst.
- Nieuwe chips moeten dezelfde familiegevoel houden:
  - pill-vorm
  - zachte achtergrond
  - korte labels
  - duidelijke active state

## Cards

### Balance cards

- `canoniek`:
  - `DashboardBalanceSummary`
- `in gebruik`:
  - grote metric-kaarten op dashboard
- `legacy`:
  - losse metric-blokken met eigen typografie of shadow buiten de dashboardfamilie

### Budget cards

- `canoniek`:
  - `BudgetMonthSummaryCard`
  - `BudgetMonthBreakdownCard`
  - `BudgetWeekRhythmCard`
  - `FinanceBudgetProgressBar`
- `in gebruik`:
  - budget-beheerkaarten en week/modaaloverzichten
- `legacy`:
  - budgetspecifieke modalcards met ruwe kleuren of eigen states buiten gedeelde surfaces

### Insight cards

- `canoniek`:
  - `FinanceInsightCard`
  - `FinanceForecastSummaryCard`
  - `FinanceCategorySummaryCard`
  - `FinanceUpcomingMomentsCard`
- `in gebruik`:
  - insight-blokken met rustige lijst- of cardopbouw
- `legacy`:
  - afwijkende donkere forecast-cardstijl als breed generiek card-contract
  - oudere insight-stijlen uit legacy-routes

### Warning and helper cards

- `canoniek`:
  - `FinanceInlineCallout`
  - `FinanceDetailCard` met `warning` tone
- `in gebruik`:
  - helperkaarten in utility-flows
- `legacy`:
  - route-specifieke waarschuwingen met losse hex-kleuren en eigen paddings

### Gebruik

- Kies eerst uit bestaande cardfamilies.
- Maak geen nieuwe kaartvariant als een bestaande surface plus inhoudsopbouw voldoende is.

## List rows

### Canoniek

- `TransactionListRow`
- `FinanceSettingsRow`
- `FinanceSettingsGroup`

### In gebruik

- category rows in `finance-category-sheet`
- bank-account rows
- subscription rows
- transaction blocks en geschiedenisrijen

### Legacy

- lijstitems met eigen drukgedrag, eigen icon-wrap of eigen divider-logica terwijl een bestaand row-patroon al dicht in de buurt zit

### Gebruik

- Links context, midden betekenis, rechts bedrag/status/actie blijft het standaard row-principe.
- Nieuwe rijen moeten scanbaar blijven en niet tegelijk card, badge en button willen zijn.

## Modals en bottom sheets

### Canoniek

- `FinanceBottomSheetShell`

### In gebruik

- `FinanceMonthSelectorModal`
- `BankAccountFormSheet`
- category-selection flows
- delete/confirm sheets in utility-flows

### Legacy

- losse `Modal`-implementaties in:
  - `settings`
  - `budget`
  - `subscriptions`
  - `transaction-detail`
- eigen backdrop, eigen sheet-radius of eigen footerpatroon buiten de shell

### Gebruik

- Nieuwe selector-, confirm- en beheerflows moeten op `FinanceBottomSheetShell` landen.
- Voeg geen nieuwe losse modal-shell toe als de gedeelde sheet al volstaat.

## Quick actions

### Canoniek

- `FinanceQuickMenu`
- `FinanceHeaderActions`

### In gebruik

- hoofdschermnavigatie in docked vorm
- header-acties met avatar en assistant-trigger
- vaste action-rows in sheets

### Legacy

- route-specifieke snelle acties die dezelfde rol hebben maar andere spacing, iconografie of kleurstructuur gebruiken

### Gebruik

- Behandel quick actions als onderdeel van shell of navigation, niet als schermspecifieke decoratie.

## Empty states

### Canoniek

- Er is nog geen enkel gedeeld empty-state component.
- Canoniek is op dit moment vooral het inhoudelijke patroon:
  - korte titel
  - korte uitleg
  - duidelijke vervolgstap

### In gebruik

- empty states in:
  - `Dashboard`
  - `Transactions`
  - `Insights`
  - `Budget`-subflows
  - `Bankrekeningen`
  - `Subscriptions`
  - `Upcoming moments`

### Legacy

- visueel verschillende empty-state layouts voor vergelijkbare situaties
- route-specifieke empty actions met eigen knopstijlen

### Gebruik

- Nieuwe empty states moeten rustig, compact en herstelgericht blijven.
- Als een nieuwe empty-state op meerdere plekken terugkomt, maak er een gedeeld component van.

## Shell and structure support

Hoewel dit document focust op componentfamilies, horen deze componenten functioneel ook in de inventory thuis:

- `FinanceDashboardHeader`
- `FinanceTopBar`
- `FinanceDetailTopBar`
- `FinanceModalTopBar`
- `FinanceHeroShell`
- `FinanceDetailShell`
- `FinanceUtilityShell`
- `FinanceAdminShell`
- `FinanceScreenBackdrop`

Deze zijn geen losse widgets, maar wel kerncomponenten van het visuele systeem.

## Samenvatting per familie

| familie | canoniek | grootste debt |
| --- | --- | --- |
| buttons | `FinanceButton` | veel losse CTA-implementaties |
| inputs | nog geen echte shared input | meerdere losse `TextInput`-stijlen |
| chips/filters | status + maandselector | filterchips en scope switch nog niet volledig genormaliseerd |
| cards | meerdere gedeelde finance cards | gemengde stijlen tussen domeinen |
| list rows | transacties en settings | account/category/subscription rows nog versnipperd |
| modals/sheets | `FinanceBottomSheetShell` | veel custom `Modal`-paden |
| quick actions | `FinanceQuickMenu`, header actions | losse snelle acties buiten shell-context |
| empty states | inhoudelijk patroon | geen gedeelde visuele component |
