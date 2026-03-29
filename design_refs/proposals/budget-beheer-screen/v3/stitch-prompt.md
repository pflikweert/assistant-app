# Stitch Prompt — Budget Beheer Variant C

Ontwerp een coachende variant van `Budget > Beheer` in Budio, zonder nieuwe design language en zonder functieverlies.

Belangrijk:
- Volledig binnen bestaand Budio design system.
- Alle zichtbare copy in eenvoudig Nederlands.
- Geen extra componentpatronen buiten bestaande shells/cards/controls.

Gebruik deze structuur:

1. Bovenaan contextkaart:
   - korte uitleg wat deze pagina doet
   - status van huidige maandplanning
2. `Stap 1` sectie: Budgetmodus + spaardoel.
3. `Stap 2` sectie: Inkomstenbasis + preview.
4. `Stap 3` sectie: Maandbudget per categorie + trend/herstelacties.
5. Secundaire sectie: Jaarlijkse lasten met beheeractie.
6. Onderaan primaire `Opslaan` actie met korte bevestigende tekst.

Gebruik bestaande componentlogica:
- mode chips
- BudgetAmountSlider
- choice chips inkomstenbasis
- maandverdeling/samenvattingsrijen
- category edit rows met lock/trend
- bestaande sheet voor jaarlijkse lasten
- bestaande primaire CTA stijl

Doel:
- pagina begrijpelijk maken voor brede doelgroep
- niet-relevante ruis verminderen
- heldere taakvolgorde met behoud van huidige mogelijkheden
