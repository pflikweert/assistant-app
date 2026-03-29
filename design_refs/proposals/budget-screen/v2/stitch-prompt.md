# Stitch Prompt — Budget Screen Variant B

## Variant

- naam: Variant B
- richting: data-first / cashflow focus
- schermtype: hoofdscherm

## Layout in natuurlijke taal

Deze variant maakt het Budget-scherm analytischer en data-gedrevener, zonder van shell of design language te wisselen. Bovenaan blijft de bestaande Budio hoofdscherm-shell behouden. Onder de hero komt een duidelijke maandcontext met selector en scope. Daarna volgt meteen een cashflow-gedreven samenvattingskaart die laat zien:

- hoeveel er nog vrij te besteden is
- hoe snel het budget wordt gebruikt
- hoeveel reserveringen of vaste druk er al op de maand zitten
- of er risico is

Na deze samenvatting volgt eerst het wekenoverzicht en daarna pas de categorieen en maandstructuur. Het scherm moet dus eerder antwoord geven op de vraag: "hoeveel ruimte heb ik nog en waar gaat de druk vandaan komen?"

## Componenten in natuurlijke taal

Gebruik alleen bestaande Budio design system regels en bestaande componentfamilies. Baseer de visuele opbouw op:

- `FinanceTopBar`
- `FinanceHeroShell`
- `FinanceMonthSelector`
- `FinanceScopeSwitch`
- `BudgetWeekRhythmCard`
- `BudgetMonthSummaryCard`
- `BudgetPressureList`
- `RiskProgressBar`
- bestaande rustige cardfamilies binnen `FinSurfaces`

Gebruik bestaande status-, progress- en sectieritmes. Geen nieuwe chartstijl, geen nieuwe data-visualisatie taal en geen nieuwe felle accenten.

## Stitch prompt

Ontwerp een mobiele Budget-screen voor Budio met een data-first en cashflow-gedreven richting. Gebruik alleen bestaande Budio design system regels: hoofdscherm-shell met topbar en hero, rustige fintech uitstraling, mobile-first, zachte cards, subtiele borders, bestaande tokenkleuren en geel alleen als functioneel accent.

Bouw het scherm in deze volgorde op:

1. topbar en hero met maandcontext
2. maandselector en scopeswitch
3. compacte segmentselector
4. een primaire data-summary kaart met:
   - nog vrij te besteden
   - bestedingstempo
   - reserveringen of vaste druk
   - risico-indicatie
5. wekenoverzicht deze maand
6. categorieoverzicht met nadruk op grootste afwijkingen
7. maandstructuur als verklarende laag
8. buiten-budget en waarschuwingen als lagere prioriteit

Gebruik visueel alleen bestaande Budio componentlogica:

- BudgetWeekRhythmCard
- BudgetMonthSummaryCard
- BudgetPressureList
- RiskProgressBar
- FinanceMonthSelector
- FinanceScopeSwitch

Het scherm moet sneller te scannen zijn voor iemand die op cashflow en tempo stuurt. Maak het informatiegedreven, maar nog steeds rustig en niet overvol. Gebruik geen nieuwe design language, geen experimentele grafieken en geen nieuwe componentpatronen buiten het bestaande systeem.
