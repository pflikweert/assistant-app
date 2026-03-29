# Budget Screen Variant B

## Concept

Data-first / cashflow focus.

Deze variant legt de nadruk op maandruimte, tempo en cashflowdruk. De schermopbouw maakt sneller zichtbaar hoeveel ruimte er nog is, waar de druk vandaan komt en welke categorieen of weken het meeste effect hebben.

## Layout structuur

- shell:
  - bestaande hoofdscherm-shell behouden
  - `FinanceScreenBackdrop`
  - `FinanceTopBar`
  - `FinanceHeroShell`
- bovenaan:
  - hero met maandlabel en cashflow-gedreven status
  - maandselector
  - scopeswitch
  - segmentselector
- segment `Nieuw`:
  - weekkaart
  - maandkaart
  - pressure list direct daaronder
- segment `Maand`:
  - data-first overzichtskaart:
    - vrij te besteden
    - besteed tempo
    - reserveringen
    - risico-indicatie
  - wekenoverzicht eerder in de flow
  - categorieoverzicht met nadruk op grootste afwijkingen
  - maandstructuur als verklarende laag
  - buiten budget en warnings als afsluitende context
- segment `Beheer`:
  - beheer opgesplitst in:
    - budgetregels
    - inkomstenbasis
    - reserveringen

## Component gebruik

### Behouden

- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetPressureList`
- `BudgetMonthBreakdownCard`
- `RiskProgressBar`

### Herordenen

- `BudgetPressureList` krijgt een hogere positie
- `historicalWeeks` komt boven categorieen
- reservegegevens worden opgenomen in de primaire data-summary in plaats van losse topkaart

### Vereenvoudigen

- minder losse helpercards
- minder aparte tussencallouts
- CTA's ondergeschikt aan de data

## Wat is beter

- Sneller te lezen voor gebruikers die primair op ruimte en tempo sturen
- Sterkere aansluiting op cashflow en risico
- Maandtab krijgt een duidelijker analytisch verhaal:
  - hoeveel ruimte is er
  - hoe snel gaat het
  - waar komt de druk vandaan

## Lichte JSX preview

```jsx
<BudgetScreenShell>
  <BudgetHeroSummary />
  <BudgetMonthSelectorRow />
  <BudgetSegmentTabs />

  <BudgetCashflowSummaryCard />
  <BudgetWeeksOverviewSection />
  <BudgetCategoryDeviationSection />
  <BudgetStructureExplainSection />

  <BudgetOutsideScopeSection />
  <BudgetWarningsSection />
</BudgetScreenShell>
```
