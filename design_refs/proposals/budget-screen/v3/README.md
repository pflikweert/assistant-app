# Budget Screen Variant C

## Concept

Coachend / insights + guidance.

Deze variant maakt Budget iets begeleidender zonder een nieuw productpatroon te introduceren. De focus ligt op wat de gebruiker nu moet begrijpen en welke kleine stap logisch is, met compacte coaching in plaats van losse veelheid aan kaarten.

## Layout structuur

- shell:
  - bestaande hoofdscherm-shell behouden
  - `FinanceScreenBackdrop`
  - `FinanceTopBar`
  - `FinanceHeroShell`
- bovenaan:
  - hero met maandstatus in begrijpelijke taal
  - maandselector
  - scopeswitch
  - segmentselector
- segment `Nieuw`:
  - weekritme
  - maandsamenvatting
  - coachende attentiekaart
- segment `Maand`:
  - primaire kaart: wat is je ruimte nu
  - coachende sectie: "Wat betekent dit?"
  - coachende actiekaart: "Beste volgende stap"
  - daarna detailblokken:
    - categorieen
    - weken
    - maandstructuur
  - warnings en buiten budget in lagere prioriteit
- segment `Beheer`:
  - beheer wordt framed als keuzes, niet als technische configuratie
  - secties per onderwerp met korte guidance boven de controls

## Component gebruik

### Behouden

- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetMonthBreakdownCard`
- `BudgetPressureList`
- bestaande beheercomponenten en sliders

### Aanpassen in opbouw

- positive card, action card en warnings worden vervangen door een compactere coachingslaag
- helperteksten worden korter en meer taakgericht
- custom buttons worden ondergeschikt aan guidance-content

### Niet doen

- geen nieuwe insights-shell maken
- geen overlap met het aparte `Insights` scherm

## Wat is beter

- Beter voor gebruikers die niet alleen cijfers willen zien, maar ook richting
- Minder cognitieve last door betere volgorde:
  - status
  - betekenis
  - stap
  - detail
- Past bij de producttoon van Budio zonder te veel analyse naar `Budget` te trekken

## Lichte JSX preview

```jsx
<BudgetScreenShell>
  <BudgetHeroSummary />
  <BudgetMonthSelectorRow />
  <BudgetSegmentTabs />

  <PrimaryBudgetSummaryCard />
  <BudgetMeaningBlock />
  <BudgetNextStepCard />

  <BudgetCategoryOverviewSection />
  <BudgetWeeksSection />
  <BudgetStructureSection />

  <LowPriorityContextSection>
    <OutsideBudgetSection />
    <WarningsSection />
  </LowPriorityContextSection>
</BudgetScreenShell>
```
