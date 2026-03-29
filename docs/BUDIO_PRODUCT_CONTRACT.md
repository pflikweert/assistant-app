# Budio Product Contract

## Doel

Dit document legt de harde productcontracten vast voor Budio als dagelijkse financiële cockpit. Het is geen pitchtekst, maar een beslis- en migratiedocument voor productkeuzes, UI-opbouw, AI-uitleg en toekomstige refactors.

Gebruik dit document samen met:

- `docs/BUDIO_PRODUCTVISIE_ROADMAP.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
- `AGENTS.md`

## Kernbelofte

Budio moet een gebruiker in het dagelijkse hoofdmoment zonder vaktaal helpen begrijpen:

- waar hij nu staat
- wat nu veilig kan
- wat eraan komt
- welke risico's dichtbij zijn
- wat nu de beste volgende actie is

Home is daarom niet slechts een overzicht, maar het primaire beslisscherm.

## Truth Hierarchy

### 1. Harde data

Bronnen:

- geboekte transacties
- laatste bekende balansanker
- expliciete accountinstellingen
- user-keuzes en opgeslagen rules/settings

Contract:

- dit is de hoogste waarheid
- UI mag dit tonen als feitelijk of actueel
- AI mag dit niet overschrijven

### 2. Afgeleide data

Bronnen:

- deterministische serviceberekeningen uit harde data
- budgetsamenvattingen
- reserve-opbouw
- categorie- en merchant-aggregaten
- explainability- en confidence-lagen

Contract:

- afgeleide data mag harde data samenvatten, structureren of labelen
- afgeleide data mag harde data niet semantisch verdraaien
- UI mag dit tonen als berekend of afgeleid, niet als ruwe waarheid

### 3. Forecast

Bronnen:

- rule-based forecastservices
- timeline-events
- safety-spend-window
- cash-gap en end-balance signalen

Contract:

- forecast is altijd verwachting, nooit zekerheid
- forecast moet zichtbaar als verwacht, gepland, indicatief of voorzichtig blijven
- forecast mag harde of afgeleide data niet overschrijven

### 4. AI-uitleg

Bronnen:

- Help Assistant
- Money Copilot-copy
- AI-suggesties op bestaande signalen

Contract:

- AI introduceert geen nieuwe financiële waarheid
- AI legt bestaande waarheid uit, vat samen, prioriteert en vertaalt naar mensentaal
- AI mag alleen adviseren binnen de grenzen van harde data, afgeleide data en forecast

## Kernbegrippen En Exacte Definities

### Huidig saldo

Definitie:

- het laatste bekende operationele saldo voor de actieve cockpit-scope op basis van het meest recente betrouwbare balansanker

Bronlaag:

- harde data

Niet hetzelfde als:

- nettovermogen
- gereserveerd geld
- verwacht eindsaldo

### Vrij besteedbaar

Definitie:

- de operationele ruimte van nu, los van maandbudget en forecast, nadat bekende beschermde reserveringen uit de operationele laag zijn afgetrokken

Bronlaag:

- afgeleide data

Huidige semantische anker:

- `freeToSpendNow`

Niet hetzelfde als:

- resterend maandbudget
- veilig tot volgende inkomen

### Veilig Tot Volgende Inkomen

Definitie:

- de voorzichtige bestedingsruimte vanaf nu tot het volgende betrouwbare hoofdinkomstenmoment, berekend op basis van `vrij besteedbaar`, bekende kosten tot dat anker en de safety-spend-window logica

Bronlaag:

- forecast bovenop afgeleide data

Huidige semantische anker:

- `safeToSpendUntilNextIncome`

Niet hetzelfde als:

- volledig vrij besteedbaar nu
- verwacht eindsaldo van de maand

### Reserveringen

Definitie:

- geld dat binnen de actieve scope bewust beschermd of apart gezet is voor buffer, jaarlijkse lasten of andere bekende verplichtingen, zowel op reserve-/goal-rekeningen als beschermd in de operationele laag

Bronlaag:

- afgeleide data

Huidige semantische ankers:

- `currentReservedBalance`
- `reservedInAccountsNow`
- `reservedProtectedInOperationalNow`

### Buffer

Definitie:

- het beschermde deel van reserveringen dat bedoeld is voor financiële stabiliteit en niet direct aan één concrete, named jaarlijkse verplichting hangt

Bronlaag:

- afgeleide data

Huidige praktische representatie:

- minimaal via `savingsTargetMonthly`
- kan onderdeel zijn van de beschermde operationele reserve

### Komende risico’s

Definitie:

- de kleinste set nabije signalen die een beslissing vandaag of deze week kunnen veranderen en die aantoonbaar voortkomen uit cash-gap risico, verwacht tekort, forse komende lasten, reserve-tekort of duidelijk ontsporend tempo

Bronlaag:

- afgeleide data en forecast

Contract:

- geen generieke onrustkaarten zonder besliswaarde
- liever geen kaart dan een vaag risico zonder handelingsperspectief

### Beste Volgende Actie

Definitie:

- de enkel hoogste-prioriteitsactie die nu de meeste rust, veiligheid, herstel of duidelijkheid oplevert op basis van de dominante constraint in de actuele financiële context

Bronlaag:

- afgeleide data, forecast en AI-uitleg

Contract:

- moet terug te leiden zijn naar bestaande signalen
- mag geen nieuwe waarheid of fictieve urgentie introduceren
- is primair een prioriteringslaag, geen nieuwe databron

## Anti-Goals

Budio mag niet afglijden naar:

- een transactiebrowser met veel deelervaringen zonder dominant home-antwoord
- een generieke budgetapp waarin categorieën belangrijker zijn dan beslissingen
- een chatproduct waarin AI belangrijker wordt dan de financiële waarheid
- een featureverzameling waarin elke nieuwe vraag een nieuw scherm krijgt
- een systeem dat voorspellingen toont alsof ze zeker zijn

## Beslisregels Voor Nieuwe Productkeuzes

Toets nieuw werk in deze volgorde:

1. maakt dit home sterker als primair beslisscherm?
2. maakt dit beter duidelijk waar de gebruiker nu staat?
3. maakt dit veilige ruimte of risico begrijpelijker?
4. maakt dit de beste volgende actie concreter?
5. voedt dit home of een bestaande motorlaag, in plaats van een nieuw producteiland te maken?

Als een voorstel op deze vragen zwak scoort, hoort het waarschijnlijk niet in Budio of niet in deze fase.

## Migratieregels

- verander nog geen interne route- of servicenames puur om producttaal te laten aansluiten
- leg eerst productcontract en beslisarchitectuur vast
- doe daarna pas selectieve code-refactors waar de nieuwe cockpitarchitectuur dat echt vraagt
- verwijder bestaande richtlijnen niet stil; maak conflicten expliciet en map ze eerst

## Acceptance Checklist Voor Toekomstige Taken

- helpt dit de gebruiker weten waar hij nu staat?
- helpt dit veilige ruimte bepalen?
- helpt dit komende risico's begrijpen?
- helpt dit de beste volgende actie kiezen?
- zo niet, waarom hoort het dan in Budio?

## Open Productpunten Die Nog Beslissing Vragen

- Moet `vrij besteedbaar` in de cockpit een zelfstandig hoofdsignaal blijven naast `veilig tot volgende inkomen`, of wordt één van de twee dominant?
- Hoe expliciet moet `buffer` voor eindgebruikers zichtbaar zijn ten opzichte van bredere `reserveringen`?
- Welke prioriteitsvolgorde bepaalt exact de `beste volgende actie` als meerdere signalen tegelijk kritisch zijn?
- Wanneer mag `komende risico's` ook subscription-optimalisatie of structurele prijsdruk tonen, en wanneer blijft het strikt bij cash- en reserve-risico?
