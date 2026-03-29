# Stitch Prompt — Budget Screen Variant A

## Variant

- naam: Variant A
- richting: minimal / rust / overzicht
- schermtype: hoofdscherm

## Layout in natuurlijke taal

Deze variant houdt het Budget-scherm rustig en overzichtelijk. Bovenaan blijft de bestaande Budio hoofdscherm-shell staan met topbar, hero, maandselector en scopeswitch. Daaronder komt een compacte segmentselector. De kern van het scherm bestaat uit een kleine set duidelijke blokken in een rustige verticale volgorde:

1. primaire samenvatting van deze maand
2. directe actie of status voor nu
3. maandstructuur
4. categorieoverzicht
5. optionele details lager op het scherm

De eerste viewport moet veel minder druk voelen dan nu. Reserve-informatie wordt ondersteunend in plaats van dominant. Warnings, buiten-budget informatie en extra weekdetails krijgen lagere visuele prioriteit.

## Componenten in natuurlijke taal

Gebruik alleen bestaande Budio design system regels en bestaande componentfamilies. Baseer de visuele opbouw op:

- `FinanceTopBar`
- `FinanceHeroShell`
- `FinanceMonthSelector`
- `FinanceScopeSwitch`
- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetMonthBreakdownCard`
- bestaande rustige cards op basis van `FinSurfaces.mainPageTintedCard` of `topLevelCard`
- bestaande sheet- en modalrichting uit `FinanceBottomSheetShell`

Gebruik geen nieuwe kleuren, geen nieuwe shadowwaarden, geen nieuwe layout-taal en geen extra visuele patronen buiten het huidige Budio systeem.

## Stitch prompt

Ontwerp een mobiele finance app screen voor Budio met de titel "Budget". Gebruik uitsluitend de bestaande Budio design system regels: rustige fintech UI, mobile-first, lichte basis, zwart/warm grijs/wit met geel als functioneel accent, bestaande hoofdscherm-shell met compacte topbar en hero, gecentreerde contentkolom en zachte cards met subtiel contrast.

Maak een minimalistische versie van het Budget-scherm. Houd de bovenkant rustig: topbar, hero met maandcontext, maandselector, scopeswitch en een compacte segmentselector. Laat daarna direct de belangrijkste budgetinformatie zien zonder visuele drukte.

De inhoudsvolgorde moet zijn:

1. een primaire maandkaart met "nog vrij te besteden"
2. een compacte status- of actiekaart voor wat nu belangrijk is
3. een rustige sectie "Maandstructuur"
4. een rustige sectie "Categorieoverzicht"
5. lagere-prioriteit details zoals weekoverzicht, buiten budget en waarschuwingen pas verder naar beneden

Gebruik bestaande Budio componentlogica als visuele referentie:

- BudgetWeekRhythmCard
- BudgetMonthSummaryCard
- BudgetMonthBreakdownCard
- FinanceMonthSelector
- FinanceScopeSwitch

Maak het scherm merkbaar rustiger dan de huidige versie. Vermijd concurrerende kaarten, vermijd zware borders en vermijd dashboarddrukte. Klikbaarheid moet duidelijk zijn via vorm, contrast en eenvoudige iconografie. Gebruik geen nieuwe componentpatronen, geen nieuwe kleuren en geen redesign-revolutie. Dit moet voelen als een evolutie van het bestaande Budio Budget-scherm.
