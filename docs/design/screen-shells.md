# Screen Shells

Dit document beschrijft de canonieke shell-opbouw van de actieve Budio-productschermen. Het bouwt voort op `docs/design/screen-inventory.md`, maar beschrijft nadrukkelijk de visuele en structurele shell-keuzes.

## Shell-principes

- Elke route is ofwel hoofdscherm, ofwel utility/detail/sheet.
- Shell-gedrag hoort in gedeelde componenten, niet in schermspecifieke layoutcode.
- Content blijft in een gecentreerde kolom met vaste `maxWidth`.
- Topbar- en hero-offset horen bij de shell-familie.

## Dashboard

### Canonieke shell

- `FinanceScreenBackdrop`
- `FinanceDashboardHeader`
- gecentreerde contentkolom
- `FinanceQuickMenu`

### Kenmerken

- Hero-less hoofdscherm
- geen losse hero-offset
- direct overzicht van stand, ruimte en signalen
- hoofdstructuur bestaat uit:
  - balans/samenvatting
  - budget/context
  - recente acties of transacties

### Niet kopieren

- dashboardspecifieke metric- of calloutstyling als generieke shell-oplossing

## Transactions list

### Canonieke shell

- `FinanceScreenBackdrop`
- `FinanceTopBar`
- `FinanceHeroShell`
- gecentreerde contentkolom
- `FinanceQuickMenu`

### Kenmerken

- hoofdtab met hero-context
- onder de hero:
  - maandcontext
  - filtertoegang
  - zoekveld
  - scanbare transactielijst
- list-first scherm, geen dashboard-achtig tegelraster

### In gebruik

- eigen filtermodal bovenop gedeelde sheet- en selectorfamilie

### Legacy

- custom filterinteractie en knoppen die niet volledig op de gedeelde button/sheetlaag leunen

## Budget screen

### Canonieke shell

- `FinanceScreenBackdrop`
- `FinanceTopBar`
- `FinanceHeroShell`
- gecentreerde contentkolom
- `FinanceMonthSelector`
- `FinanceScopeSwitch`

### Kenmerken

- hoofdtab met hero-context
- maand- en weeksturing leven onder dezelfde shell
- content bestaat uit rustige verticale secties:
  - samenvatting
  - voortgang
  - weekritme
  - beheer

### In gebruik

- meerdere budgetsubflows gebruiken nog eigen modal- of detailopbouw

### Legacy

- losse `Modal`-implementaties en inline interactiepatronen die buiten de gedeelde sheet-shell vallen

## Insights screen

### Canonieke shell

- `FinanceScreenBackdrop`
- `FinanceTopBar`
- `FinanceHeroShell`
- gecentreerde contentkolom
- `FinanceMonthSelector`
- `FinanceScopeSwitch`

### Kenmerken

- rustige scrollpagina zonder extra subnavigatie bovenaan
- hero zet de maandcontext en verwachting
- secties bestaan typisch uit:
  - forecast summary
  - `Wat valt op`
  - categorie-overzicht
  - komende momenten

### In gebruik

- eigen insight-cardfamilie is productmatig sterk, maar nog niet volledig gelijkgetrokken met de rest van het card-contract

### Legacy

- donkere forecast-card als generieke standaard voor andere domeinen
- `insights-legacy` telt niet als bron voor nieuwe shellbeslissingen

## Settings

### Canonieke shell

- `FinanceUtilityShell`
- `FinanceSettingsGroup`
- `FinanceSettingsRow`
- optioneel `FinanceQuickMenu` als dit scherm in tabcontext leeft

### Kenmerken

- utility-scherm, geen hoofdscherm-hero nodig
- overzicht van beheer- en onderhoudsacties
- gegroepeerde cards met duidelijke rows

### In gebruik

- utility shell plus grouped settings rows werkt al als gedeeld patroon

### Legacy

- custom confirm/success/error modals naast de gedeelde `FinanceBottomSheetShell`

## Utility screens

### Canonieke shellfamilies

- detail:
  - `FinanceDetailShell`
- utility-overzicht:
  - `FinanceUtilityShell`
- admin:
  - `FinanceAdminShell`

### Detail shell

- gebruiken voor:
  - `Transaction Detail`
  - `Analysis Detail`
  - andere compacte detailroutes
- opbouw:
  - `FinanceScreenBackdrop`
  - `FinanceDetailTopBar`
  - scrollcontent in vaste contentkolom

### Utility shell

- gebruiken voor:
  - `Bankrekeningen`
  - `Subscriptions`
  - `Settings`
  - vergelijkbare beheerflows
- ondersteunt:
  - topbarvariant
  - back-variant
  - optionele hero

### In gebruik

- utility-flows gebruiken al grotendeels dezelfde shellfamilie, maar de inhoudscomponenten zijn nog niet overal gelijkgetrokken

### Legacy

- utility-schermen die naast de shell nog een eigen modallaag of eigen formulierfamilie meenemen

## Modal and sheet patterns

### Canonieke shell

- `FinanceBottomSheetShell`

### Wat bij de shell hoort

- backdrop
- sheet-radius
- handle
- header
- close-knop
- body-zone
- vaste footerzone

### Gebruik

- selectorflows
- confirm/delete flows
- create/edit flows
- maand- en keuzeoverlays

### Niet kopieren

- losse `Modal`-implementaties met eigen card, eigen overlay en eigen footerpatroon

### Huidige uitzonderingen

- `budget`
- `settings`
- `subscriptions`
- `transaction-detail`

Deze bestaan in de codebase, maar zijn geen canonieke basis voor nieuwe flows.

## Shell-afspraken die vast blijven

- hoofdschermen:
  - `FinanceTopBar` plus `FinanceHeroShell`
  - behalve dashboard, dat hero-less blijft via `FinanceDashboardHeader`
- detailschermen:
  - `FinanceDetailShell`
- utility-schermen:
  - `FinanceUtilityShell`
- sheets:
  - `FinanceBottomSheetShell`
- backdrop:
  - `FinanceScreenBackdrop`

## Bekende inconsistenties op shellniveau

- meerdere bijna-gelijke headerfamilies
- utility- en detailschermen die alsnog losse modalstructuren meenemen
- afwijkende contentritmes tussen sommige utility-flows
- koele backdropkleur die niet volledig samenvalt met de warmere basiskleuren uit `theme.ts`

## Richting voor nieuwe schermen

- Kies eerst expliciet de shellfamilie.
- Gebruik daarna alleen de componenten die logisch bij die shell horen.
- Introduceer geen hybride schermen die tegelijk hoofdscherm- en utilitygedrag tonen.
- Als een afwijking toch nodig is, documenteer die als uitzondering en behandel hem niet als nieuw standaardpatroon.
