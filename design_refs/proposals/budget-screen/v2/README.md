# Budget Screen Variant B

## Stitch Preview

- project: `12076228720239525233`
- screen: `8b46a90dc18d4839be7dc8561558afce`
- preview: https://lh3.googleusercontent.com/aida/ADBb0uiF-nzcWUkIiRBPB37OZLJByCjU403yNqI9xRg6u6S2QsNUe_G766za9Na3QupcqUFQc-lLup_AEL_g72W6CfSa6hcyPRGVKTvagsEV08JzHeBzveJDLGRXGwYAw8ab8DCDg4W-nCC3bDxie37_xHPhAhqEsheS0XXB84fvCCLQ8imZh61kcjar-4DTSaOR0HbAjadSOWMUM71RgqVt_fHUtA15yhouFFav0mx4NP4Zvy8BmGM2aL31t3Q

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
