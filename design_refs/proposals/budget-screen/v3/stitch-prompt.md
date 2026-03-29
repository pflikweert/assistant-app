# Stitch Prompt — Budget Screen Variant C

## Variant

- naam: Variant C
- richting: coachend / insights + guidance
- schermtype: hoofdscherm

## Layout in natuurlijke taal

Deze variant maakt het Budget-scherm begeleidender, zonder het te veranderen in een tweede Insights-scherm. De shell blijft hetzelfde, maar de content wordt geordend als:

1. wat is je ruimte nu
2. wat betekent dat voor deze maand
3. wat is de beste volgende stap
4. welke details onderbouwen dat

De eerste viewport moet dus niet alleen cijfers tonen, maar ook betekenis en richting. De maandkaart blijft primair. Daarna volgt een compacte coachende laag met uitleg en een logische vervolgstap. Detailinformatie zoals categorieen, weken en maandstructuur komt daarna, met waarschuwingen en buiten-budget informatie op een lager niveau.

## Componenten in natuurlijke taal

Gebruik alleen bestaande Budio design system regels en bestaande componentfamilies. Baseer de visuele opbouw op:

- `FinanceTopBar`
- `FinanceHeroShell`
- `FinanceMonthSelector`
- `FinanceScopeSwitch`
- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetMonthBreakdownCard`
- `BudgetPressureList`
- bestaande rustige callout- en cardlogica binnen het Budio systeem

Maak de guidance compact en rustig. Geen nieuwe AI-achtige panelen, geen nieuwe inzichten-shell en geen zware visual effects.

## Stitch prompt

Ontwerp een mobiele Budget-screen voor Budio die coachender aanvoelt, maar volledig binnen het bestaande Budio design system blijft. Gebruik de bestaande hoofdscherm-shell met topbar, hero en gecentreerde contentkolom. Werk mobile-first. Houd de uitstraling rustig, helder en vriendelijk, met wit, warm grijs en zwart als basis en geel als functioneel accent.

Gebruik deze inhoudsvolgorde:

1. topbar en hero met maandcontext
2. maandselector en scopeswitch
3. segmentselector
4. primaire kaart met "nog vrij te besteden"
5. compacte coachende sectie die uitlegt wat dit betekent
6. compacte actiekaart met beste volgende stap
7. detailsecties voor categorieen, weken en maandstructuur
8. warnings en buiten-budget informatie lager in de scroll

Gebruik alleen bestaande Budio componentlogica en patroonfamilies:

- BudgetWeekRhythmCard
- BudgetMonthSummaryCard
- BudgetMonthBreakdownCard
- BudgetPressureList
- FinanceMonthSelector
- FinanceScopeSwitch

De tone of voice moet rustig en coachend zijn, niet technisch en niet dramatisch. Het scherm mag helpen kiezen, maar moet visueel eenvoudig blijven. Voeg geen nieuwe componentpatronen, geen nieuwe kleuren en geen losse design language toe. Dit moet aanvoelen als een natuurlijke evolutie van het bestaande Budget-scherm, met meer guidance en minder cognitieve belasting.
