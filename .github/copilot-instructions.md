# Copilot Instructions: 7-daagse overlapweken in budgetplanning

> Voor abonnementen/PSP-matching: gebruik `./.github/copilot-subscriptions-instructions.md`.

## Doel
Implementeer weekplanning als **altijd 7 dagen (maandag t/m zondag)**, ook als een week over maandgrenzen loopt.  
De budgetlogica moet voor overlapweken correct omgaan met budget uit vorige/huidige/volgende maand.

## Belangrijke randvoorwaarden
- Breek bestaande maandtotalen en maandrapportage niet.
- Houd alle datumberekeningen in UTC (`T00:00:00.000Z`).
- `weeklyVariablePlan` en `weeklySpendBreakdown` moeten exact dezelfde weekranges gebruiken.
- Geen deelweken meer aan begin/einde van de maand.

## Te wijzigen bestanden
- `services/budget-plan.ts`
- `types/categorization.ts`
- `app/(tabs)/budget.tsx`
- Optioneel validatiescript: `scripts/validate-march-2026-week-budgets.js`

## Implementatierichting

### 1) Maak kalenderweken (altijd 7 dagen)
Vervang maand-geknipte weekranges door kalenderweken:
- Eerste week start op maandag van de week waarin `monthStart` valt.
- Laatste week eindigt op maandag na de week waarin `monthEndExclusive - 1 dag` valt.
- Elke range heeft precies 7 dagen.

Voeg weekmetadata toe:
- `daysInCurrentMonth`
- `daysInPreviousMonth`
- `daysInNextMonth`
- `crossesMonthBoundary` (boolean)

### 2) Bereken weekbudget op dagniveau per maand
Voor overlapweken moet het weekbudget bestaan uit 7 dagbudgetten:
- `dailyRate(month) = variableMonthlyBudget(month) / daysInMonth(month)`
- `weekBudget = som van dailyRate` voor elke dag in die 7-daagse week

Bron voor `variableMonthlyBudget(month)`:
1. Pak maandoverride voor `variable_costs` van die maand indien aanwezig.
2. Anders fallback naar berekende `variable_costs` maandbudget van de geselecteerde maand.

Benodigde data:
- Haal maandwaarden op voor vorige, huidige en volgende maand (minimaal `variable_costs`).

### 3) Gebruik overlappende transactierange voor weekuitgaven
Weekuitgaven mogen niet stoppen op maandgrens:
- Bereken een `weekWindowStart` (eerste weekstart) en `weekWindowEndExclusive` (laatste weekeinde).
- Zorg dat transacties voor weekoverzichten deze volledige range dekken.
- Houd maandberekeningen (`monthToDate`, recommendations, etc.) op de huidige maandrange.

### 4) Houd weekrijen en detailmodal consistent
In de UI:
- Toon weekstart en weekeinde als 7-daagse kalenderweek.
- Gebruik bestaande formatters, maar verwacht geen deelweken meer.
- Gebruik weekmetadata om overlap te kunnen tonen (bijv. subtitel "2 dagen vorige maand").

### 5) Type-updates
Pas types aan zodat overlapinformatie beschikbaar is in UI en services:
- `BudgetWeekPlanRow` uitbreiden met overlapvelden.
- `BudgetWeekSpendBreakdown` eventueel uitbreiden met `startDate`/`endDateExclusive` als koppeling robuuster moet dan alleen `weekNumber`.

## Acceptatiecriteria
- Elke week in weekplanning bevat exact 7 dagen.
- Eerste/laatste week van de maand kan dagen uit aangrenzende maanden bevatten.
- Budget van overlapweken is niet kunstmatig laag door maandknip.
- `weeklyVariablePlan` en `weeklySpendBreakdown` blijven 1-op-1 uitlijnbaar.
- Bestaande maandtotalen, warnings en recommendation-berekeningen blijven functioneel gelijk voor de geselecteerde maand.

## Tests / checks
Test minimaal deze maanden:
- Maand die op zondag start (bijv. maart 2026).
- Maand die op maandag start.
- Maand die op zaterdag eindigt.

Controleer:
- Aantal weekrijen: 4, 5 of 6 afhankelijk van kalender.
- Som van weekbudgetten is logisch en stabiel.
- Detailmodal haalt transacties op uit de volledige 7-daagse weekrange.
