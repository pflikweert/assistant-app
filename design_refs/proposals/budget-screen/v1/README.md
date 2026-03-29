# Budget Screen Variant A

## Concept

Minimal / rust / overzicht.

Deze variant maakt van Budget opnieuw een kalm sturingsscherm. De nadruk ligt op minder blokken, minder concurrentie tussen kaarten en een duidelijk ritme van:

1. waar sta ik nu
2. wat vraagt aandacht
3. waar kan ik verdiepen of beheren

## Layout structuur

- shell:
  - bestaande hoofdscherm-shell behouden
  - `FinanceScreenBackdrop`
  - `FinanceTopBar`
  - `FinanceHeroShell`
- bovenaan:
  - hero met korte maandstatus
  - maandselector
  - scopeswitch
  - compactere segmentselector
- segment `Nieuw`:
  - `BudgetWeekRhythmCard`
  - `BudgetMonthSummaryCard`
  - compacte attentielijst
- segment `Maand`:
  - primaire samenvattingskaart: vrij te besteden
  - secundaire actieregel: "Wat nu"
  - twee rustige detailsecties:
    - maandstructuur
    - categorieoverzicht
  - optionele verdiepingen:
    - wekenoverzicht
    - buiten budget
    - waarschuwingen
- segment `Beheer`:
  - beheerblokken in kleinere, duidelijk gegroepeerde secties
  - save CTA pas onderaan

## Component gebruik

### Behouden

- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetMonthBreakdownCard`
- `BudgetPressureList`
- `FinanceMonthSelector`
- `FinanceScopeSwitch`

### Samenvoegen of vereenvoudigen

- reserve summary card wordt kleiner en verschuift naar ondersteunende context
- custom action card en positive card worden samengebracht tot een rustiger "Wat nu"-blok
- custom statuschips volgen een beperkter statusritme

### Niet uitbreiden

- extra custom cards
- extra custom CTA-stijlen
- extra losse modalvarianten

## Wat is beter

- Minder visuele ruis in de eerste viewport
- Duidelijker onderscheid tussen primair en secundair
- Minder dashboardgevoel in de maandtab
- Meer rust voor gebruikers die vooral willen weten of ze nog ruimte hebben

## Lichte JSX preview

```jsx
<BudgetScreenShell>
  <BudgetHeroSummary />
  <BudgetMonthSelectorRow />
  <BudgetSegmentTabs />

  <PrimaryBudgetSummaryCard />
  <BudgetActionStrip />

  <BudgetStructureSection />
  <BudgetCategoryOverviewSection />

  <OptionalDisclosureSection title="Meer details">
    <BudgetWeeksSection />
    <OutsideBudgetSection />
    <WarningsSection />
  </OptionalDisclosureSection>
</BudgetScreenShell>
```
