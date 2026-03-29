# Stitch Prompt — Budget Beheer Variant A

Ontwerp een mobiele beheersectie binnen het bestaande Budio Budget-scherm (segment: `Beheer`), met een minimalistische en rustige richting.

Belangrijk:
- Gebruik alleen bestaande Budio design system regels.
- Geen nieuwe componentpatronen, geen nieuwe kleuren, geen nieuwe design language.
- Alle zichtbare copy in het Nederlands en eenvoudig begrijpelijk.
- Behoud alle bestaande functionaliteit.

Gebruik deze opbouw:

1. Bovenaan één duidelijke hoofdkaart: `Budgetmodus + spaardoel`.
2. Daaronder één kaart: `Inkomstenbasis` met preview.
3. Daaronder compacte kaart: `Maandverdeling` (inkomend, ingepland, resterend).
4. Daarna `Maandbudget per categorie` met bestaande rows en acties.
5. `Jaarlijkse lasten` lager op de pagina als secundaire kaart met beheeractie.
6. Onderaan duidelijke primaire `Opslaan` actie.

Gebruik bestaande Budio componentlogica als visuele referentie:
- mode chips
- BudgetAmountSlider
- choice chips voor inkomstenbasis
- samenvattingsrijen
- categorie-begrotingsrijen met trend/lock acties
- bestaande bottom-sheet voor jaarlijkse lasten

Doel:
- minder visuele drukte
- duidelijke hiërarchie
- begrijpelijke taal voor brede doelgroep
- volledige functionele parity met huidige beheerflow
