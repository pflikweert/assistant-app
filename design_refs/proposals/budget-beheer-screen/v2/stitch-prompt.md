# Stitch Prompt — Budget Beheer Variant B

Ontwerp een mobiele `Budget > Beheer` variant voor Budio met data-first focus, binnen het bestaande design system.

Randvoorwaarden:
- Behoud alle bestaande functionaliteit.
- Geen nieuwe componentpatronen of nieuwe kleuren.
- Rustige fintech uitstraling, mobile-first.
- Zichtbare copy volledig Nederlandstalig en niet technisch.

Layoutvolgorde:

1. Bovenaan compacte statuskaart met:
   - inkomend budget
   - ingepland totaal
   - resterende ruimte
   - statuslabel (`Op schema` of `Let op`)
2. Instellingenblok voor `Budgetmodus + spaardoel`.
3. Instellingenblok voor `Inkomstenbasis` met preview.
4. Grote sectie `Maandbudget per categorie` met bestaande inputs, lock/trend acties en `Herstel trendbedragen`.
5. Secundaire kaart `Jaarlijkse lasten` met beheeractie.
6. Onderaan duidelijke primaire `Opslaan` actie.

Gebruik bestaande Budio componentfamilies en ritmes:
- samenvattingsrijen
- mode chips + slider
- keuzechips inkomstenbasis
- category budget edit rows
- reserve-rules bottom sheet
- bestaande CTA stijl

Doel:
- eerst inzicht, dan instellingen
- minder visuele ruis
- behoud van alle huidige interacties
