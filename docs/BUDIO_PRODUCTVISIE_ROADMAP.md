# Budio Productvisie En Roadmap

## Versieblok

- Datum: 29 maart 2026
- Bron: verwerkt uit `Budio_productvisie_review_roadmap.docx`
- Doel: expliciete productbron voor repo-instructies, documentatie, backlog en assistant-richting

## Nieuwe kernzin

Budio is de dagelijkse financiële cockpit die huishoudens zonder vaktaal laat zien waar ze staan, wat eraan komt, wat veilig kan en wat nu de slimste volgende stap is.

## Merkzin

Budio maakt van geldstress een bestuurbaar systeem.

## Waarom deze koers

De huidige codebase heeft al sterke budget-, forecast-, transactie- en AI-fundamenten. De grootste kans ligt daarom niet in meer losse features, maar in productcompressie:

- minder voelen als budgetapp
- meer voelen als dagelijkse cockpit
- minder intern georganiseerde logica zichtbaar maken
- meer direct antwoord geven op de paar vragen die dagelijks tellen

## Ontwerpprincipes Voor Deze Visie

- Niet categorieën centraal, maar beslissingen.
- Niet meer schermen, maar één dominante ervaring.
- Niet AI-chat als losse feature, maar contextuele hulp op het juiste moment.
- Niet alleen terugkijken, maar vooruitzien en helpen sturen.
- Niet financiële vaktaal, maar menselijke, geruststellende producttaal.
- Niet productexplosie, maar productcompressie.

## Wat Dit Concreet Betekent

### Home Eerst

Het home- of dashboard-scherm is niet langer alleen een overzicht. Het is het productmoment dat in seconden antwoord moet geven op:

- `Nu vrij`
- `Veilig tot volgende inkomen`
- `Komende risico's`
- `Beste actie vandaag`
- `Verwacht eindsaldo`

### Onderliggende Motoren

`Budget`, `Insights`, forecast, subscriptions en transactielogica blijven belangrijk, maar vooral als onderliggende motoren voor de cockpit. Ze zijn niet langer de primaire productidentiteit.

### Context-First AI

De Help Assistant wordt productmatig gepositioneerd als `Money Copilot`:

- uitleggend in plaats van alleen classificerend
- contextueel in plaats van chat-first
- besluitondersteunend in plaats van losstaand

### Closed-Loop Richting

Budio moet op termijn niet alleen signaleren, maar ook:

- herstelacties voorstellen
- reserveringen aanraden
- risico's eerder zichtbaar maken
- transparant helpen sturen

## Herschreven Projectportfolio

### 1. Budio Zero

Doel: maak één absurd goed homescreen.

- gebruik bestaande forecast-, insights- en balance-logica als fundament
- laat home direct antwoord geven in plaats van doorverwijzen naar complexiteit

### 2. Safe-to-Spend Engine

Doel: beantwoord perfect wat vandaag of deze week veilig kan.

- combineer live saldo, vaste lasten, inkomensmomenten, reserveringen en tempo
- voeg scenario's toe zoals extra uitgaven van EUR 50 of EUR 100

### 3. Autopilot Reserves

Doel: maak reserveren slim, haalbaar en rustig.

- herken patronen voor auto, onderhoud, eigen risico, cadeaus en seizoenskosten
- scheid vrij besteedbaar, gereserveerd, buffer en hard risico duidelijk

### 4. Subscription Assassin

Doel: maak abonnementenbeheer een tastbare bespaarmachine.

- classificeer op essentieel, twijfelachtig, duplicaat, prijsstijging en lage waarde
- toon directe maand- en jaarimpact van opzeggen of downgraden

### 5. The Money Copilot

Doel: bouw een AI-laag die uitlegt en richting geeft.

- leg uit waarom een maand krap voelt
- toon waar geld weglekt
- geef de beste drie acties, met factoren en zekerheidsniveau

### 6. Essential Optimizer

Doel: focus op de posten die huishoudens echt raken.

- boodschappen
- energie
- vervoer
- vaste lasten
- terugkerende kosten

### 7. Budio Agent Layer

Doel: zet de stap van observatie naar half-autonome assistentie.

- proactieve reserverings- en herstelvoorstellen
- transparant en controleerbaar, met gebruiker aan het stuur

### 8. Connected Money Graph

Doel: bouw de datalaag die gedrag, vaste lasten en seizoenspieken echt begrijpt.

- modelleer stabiele inkomsten, harde lasten, gedragsuitgaven en interne overboekingen
- bereid de architectuur voor op rijkere datastromen

## Prioriteiten En Volgorde

### Fase 1

- `Budio Zero`
- `Safe-to-Spend Engine`
- `Autopilot Reserves`
- `Subscription Assassin`

Dit is de snelste route naar duidelijke positionering, directe gebruikerswaarde en retentie.

### Fase 2

- `The Money Copilot`
- `Essential Optimizer`

Deze fase maakt de ervaring slimmer en coachender zodra het home-productmoment al sterk staat.

### Fase 3

- `Budio Agent Layer`
- `Connected Money Graph`

Deze fase verschuift Budio van slimme app naar financieel besturingssysteem.

## Beslisregels Voor Nieuwe Taken

Toets nieuw werk altijd eerst aan deze vragen:

- maakt dit de gebruiker rustiger?
- maakt dit de veilige ruimte duidelijker?
- maakt dit de volgende actie concreter?
- maakt dit home sterker als dominante ervaring?

Als het antwoord op alle vier zwak is, dan is het waarschijnlijk geen prioriteit.

## Repo-Impact

Deze visie is leidend voor:

- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
- `AGENTS.md`
- `docs/BUDIO_FUNCTIONALITEITEN.md`
- `OPEN_TAKEN_FINANCE_APP.md`
- `README.md`
- Budio-specifieke Codex-skills en assistant-documentatie
