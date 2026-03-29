# Analyse — Budget Beheer Screen

## Huidige componenten (segment `manage`)

Bron: `app/(tabs)/budget.tsx` binnen `segment === "manage"`.

- `Budgetmodus` kaart
  - mode chips (`Actief sparen`, `Gebalanceerd`, `Aangepast`)
  - modebeschrijving
  - spaardoel preview of slider (`BudgetAmountSlider`)
- `Jaarlijkse lasten` kaart
  - samenvatting regels
  - `Beheer` actie naar `FinanceBottomSheetShell`
- `Inkomstenbasis` kaart
  - include/exclude chips
  - preview inkomend budget
- `Maandverdeling` kaart
  - inkomend/ingepland/resterende ruimte samenvatting
  - inline waarschuwing bij overallocatie
- `Maandbudget per categorie` kaart
  - trend/herstelactie
  - lijst met categorie-inputs, lock/trend acties
  - spaardoel read-only rij
- losse `Opslaan` actiekaart onderaan

## Wat is nu inconsistent of te druk

- Te veel tekstblokken met vergelijkbare helpercopy op gelijk visueel niveau.
- Veel kaartsecties met vergelijkbare nadruk; primaire taak is niet meteen duidelijk.
- Belangrijke acties (`Opslaan`, `Herstel trendbedragen`, `Beheer`) concurreren visueel.
- Informatie over forecast/trend/budgetbasis staat verspreid over meerdere kaarten.
- Terminologie is deels technisch voor brede doelgroep (`forecast source`, `trendbedragen`, etc.).
- Het ritme van de pagina voelt lang en “formulier-zwaar” voordat kernkeuzes duidelijk zijn.

## Waar hiërarchie mist

- “Wat moet ik nu als eerste doen?” is niet direct zichtbaar.
- Kernsturing (ruimte + spaardoel + maandverdeling) staat niet compact bovenaan als één verhaal.
- Categoriebeheer (grootste blok) mist een duidelijke samenvatting boven de details.

## Functionele constraints (moet behouden)

- Geen verlies van bestaande interacties en businesslogica.
- Mode-keuze, spaardoel, inkomstenbasis, reserve-regels, trend-herstel, categoriebedragen en saveflow blijven behouden.
- Bestaande sheets en detailflows blijven bruikbaar.
