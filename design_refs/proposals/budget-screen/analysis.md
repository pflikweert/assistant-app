# Budget Screen Analyse

## Schermclassificatie

- type: `hoofdscherm`
- canonieke shell:
  - `FinanceScreenBackdrop`
  - `FinanceTopBar`
  - `FinanceHeroShell`
  - gecentreerde contentkolom
  - `FinanceMonthSelector`
  - `FinanceScopeSwitch`

## Huidige componenten

### Gedeelde shell- en navigatiecomponenten

- `FinanceScreenBackdrop`
- `FinanceTopBar`
- `FinanceHeaderActions`
- `FinanceHeroShell`
- `FinanceMonthSelector`
- `FinanceMonthSelectorModal`
- `FinanceScopeSwitch`
- `FinanceBottomSheetShell`

### Budget- en contentcomponenten

- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetMonthBreakdownCard`
- `BudgetPressureList`
- `BudgetWeekBreakdownModal`
- `BudgetCategoryProgressRow`
- `BudgetAmountSlider`
- `RiskProgressBar`
- `TransactionCategoryIcon`
- `AppIcon`

### Schermspecifieke custom UI in `app/(tabs)/budget.tsx`

- segmentchips via `TouchableOpacity`
- custom cards zoals:
  - `heroCard`
  - `card`
  - `positiveCard`
  - `actionCard`
  - `reserveSummaryCard`
- custom statuschips
- custom primary/secondary buttons
- meerdere losse `Modal`-sheets voor:
  - maandstructuur detail
  - weekdetail
  - categorie-detail
  - buiten budget

## Inconsistenties

- Het scherm gebruikt wel de gedeelde hoofdscherm-shell, maar een groot deel van de inhoud gebruikt nog losse schermspecifieke cards en knoppen.
- `FinanceButton` wordt niet gebruikt voor de hoofdacties; er zijn custom primary/secondary button-stijlen.
- `FinanceText` wordt nauwelijks gebruikt; veel typografie leeft direct in styles.
- De segmentkeuze (`Nieuw`, `Maand`, `Beheer`) gebruikt een eigen chipstijl in plaats van een gedeelde selectorfamilie.
- Er bestaan meerdere detail- en overlaypatronen naast `FinanceBottomSheetShell`.
- Statusweergave gebeurt op meerdere manieren:
  - custom statuschips
  - progressbars
  - inline helperteksten
  - warnings als losse bulletlijst

## Waar zit visuele drukte

### Top van het scherm

- Boven de hoofdcontent stapelen direct op elkaar:
  - hero
  - maandselector
  - scopeswitch
  - segmentchips
  - reserveringskaart
- Daardoor is de eerste viewport druk voordat de gebruiker bij de kern van de budgettaak komt.

### Segment `month`

- De maandtab bevat veel gelijkwaardige blokken achter elkaar:
  - vrij te besteden hero-card
  - actie voor nu
  - positieve callout
  - maandstructuur
  - categorieoverzicht
  - wekenoverzicht
  - spaardoel
  - buiten budget
  - waarschuwingen
- Deze blokken concurreren visueel te veel op hetzelfde niveau.

### Segment `manage`

- De beheertab combineert:
  - moduskeuze
  - reservebeheer
  - inkomstenbasis
  - maandverdeling
  - categoriebudgetten
  - trend- en lock-acties
  - save CTA
- Daardoor voelt beheer zwaar en formulierachtig.

## Waar mist hierarchie

- Het is niet altijd duidelijk wat de primaire budgetvraag van het scherm is:
  - weeksturing
  - maandsturing
  - beheer
  - forecasting context
- `Nieuw`, `Maand` en `Beheer` verschillen sterk in densiteit, maar krijgen visueel bijna hetzelfde gewicht.
- In `month` is "Nog vrij te besteden" wel prominent, maar de daaropvolgende inhoud mist een strakke volgorde van:
  - wat is nu belangrijk
  - wat vraagt actie
  - welke detailinformatie ondersteunt dat
- In `manage` staan edit-controls en uitlegcopij op vergelijkbaar visueel niveau, waardoor de scanbaarheid afneemt.

## Wat behouden moet blijven

- bestaande hoofdscherm-shell
- maandcontext bovenin
- scope-switch waar relevant
- duidelijke scheiding tussen:
  - weeksturing
  - maandsturing
  - beheer
- bestaande budgetlogica en datamodellen
- bestaande budgetcomponenten die al product-specifieke waarde hebben:
  - `BudgetWeekRhythmCard`
  - `BudgetMonthSummaryCard`
  - `BudgetMonthBreakdownCard`
  - `BudgetPressureList`

## Ontwerprichting voor proposals

- Rustiger top-of-screen ritme
- Minder concurrerende kaarten
- Sterkere primaire hiërarchie per segment
- Meer hergebruik van bestaande shell- en componentfamilies
- Minder custom modal- en buttonpaden
