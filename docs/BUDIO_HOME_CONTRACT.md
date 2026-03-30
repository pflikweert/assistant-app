# Budio Home Contract

## Doel

Dit document legt vast wat `Home` in Budio precies is, welke vragen het scherm altijd moet beantwoorden en welke informatie daar wel of niet primair thuishoort.

Gebruik dit document samen met:

- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`
- `AGENTS.md`

## Wat Home In Budio Is

Home is het primaire beslisscherm van Budio: de dagelijkse financiële cockpit waarin de gebruiker in een paar seconden begrijpt hoe veilig de situatie nu is en wat vandaag het belangrijkst is.

Home is daarom expliciet niet:

- een generiek dashboard met gelijkwaardige kaarten
- een overzichtsscherm dat vooral doorverwijst
- een browse-oppervlak voor transacties, budgetcategorieen of abonnementen
- een tweede Insights- of chatlaag

Home moet in het dagelijkse moment vooral antwoord geven op:

- hoe veilig sta ik tot mijn volgende inkomen?
- wat moet ik nu als eerste weten of doen?

## De 5 Vragen Die Home Altijd Moet Beantwoorden

1. Waar sta ik nu?
2. Hoeveel is veilig tot mijn volgende inkomen?
3. Wat is nu vrij als operationele context?
4. Welk komend risico kan mijn ruimte of rust binnenkort veranderen?
5. Wat is nu de beste volgende actie?

`Reserves & buffer` is een verplicht ondersteunend Home-blok dat vraag 2 en 4 aanscherpt, maar geen los extra hoofdmoment boven deze vijf vragen vormt.

## Verplichte Home-Blokken

### 1. Cockpit Head

Verplicht zichtbaar:

- `Veilig tot volgende inkomen` als dominant primair Home-signaal
- `Nu vrij` / `Vrij besteedbaar` als secundair contextsignaal
- actuele rekeningstand als ondersteunende stand-context

Contract:

- `Veilig tot volgende inkomen` draagt de meeste visuele en inhoudelijke nadruk
- `Nu vrij` blijft zichtbaar, maar is niet het leidende antwoord van Home
- de cockpit-head mag niet aanvoelen als een rij gelijkwaardige stats

### 2. Komende risico's

Verplicht zichtbaar als compact dominant beslisblok.

Contract:

- Home toont maximaal 1 dominante risicokaart
- het risico moet aantoonbaar besliswaarde hebben voor vandaag of deze week
- liever geen kaart dan een vage of generieke onrustkaart

### 3. Beste actie vandaag

Verplicht zichtbaar als compact dominant beslisblok.

Contract:

- Home toont exact 1 dominante hoofdactie
- deze actie komt voort uit bestaande signalen en prioriteitslogica
- de kaart moet concreet helpen om rust, ruimte of herstel te vergroten

### 4. Reserves & buffer

Verplicht zichtbaar als compact ondersteunend blok.

Contract:

- `Buffer` blijft een apart user-facing concept
- op Home wordt dit samengebracht in 1 compact blok `Reserves & buffer`
- binnen dit blok wordt `buffer` apart benoemd als subregel of substat
- het blok ondersteunt de cockpitbeslissing, maar mag niet even luid zijn als het hoofdgetal of de dominante beslisblokken

## Secundaire Of Optionele Home-Blokken

Deze blokken mogen aanwezig zijn als ze de cockpit versterken, maar zijn ondergeschikt aan de verplichte Home-blokken:

- `Verwacht eindsaldo`
- `Komende momenten`, alleen als de data concreet genoeg is om echte besliswaarde te geven
- een korte `Money Copilot`-uitlegzin of callout die bestaande waarheid verklaart

Contract:

- secundaire blokken mogen de cockpit-head, het dominante risico of de dominante actie niet overvleugelen
- Home blijft een cockpit en geen scrollend verzameloverzicht

## Alleen Via Drilldown Of Detail

De volgende informatie hoort niet als primaire Home-content:

- volledige uitsplitsing van reserveringen per account, doel of verplichting
- expliciete detailsplit tussen:
  - buffer
  - gereserveerd voor concrete doelen of verplichtingen
- volledige budgetcategorie-overzichten en beheeropties
- forecast-timeline, scenariovergelijking en technische aannames
- transactielijsten, categorisatiecorrecties en matchbeheer
- subscription-optimalisatielijsten, profielbeheer en bespaarjachten zonder nabije cash-impact
- meerdere gelijktijdige risico- of actiekaarten
- uitgebreide AI-uitleg die verder gaat dan korte context

## Vaste Prioriteitsvolgorde Voor Signalen En Acties

Deze vaste volgorde bepaalt zowel welk risico op Home domineert als welke `beste volgende actie` wordt gekozen:

1. cash survival risk
2. harde nabije verplichting
3. buffer / reserve protection
4. gedragstempo / overspending
5. subscription optimization

Contract:

- Home resolveert conflicten altijd volgens deze volgorde
- de risicokaart en actiekaart moeten op dezelfde prioriteitslogica terug te voeren zijn
- subscription optimization is per definitie lager prioriteit dan cash-, verplichting-, buffer- en tempoproblemen

## Komende Risico's Versus Subscription-Optimalisatie

Contract:

- subscriptions horen standaard niet thuis in `Komende risico's`
- subscriptions mogen daar alleen verschijnen als er een nabije, aantoonbare cash-impact of tijdsgevoelig financieel risico is
- zonder die drempel horen subscriptions thuis in optimalisatie-, detail- of `Money Copilot`-lagen

## Samenvatting Van De Home-Hierarchie

1. `Veilig tot volgende inkomen`
2. `Nu vrij` plus actuele rekeningstand als context
3. 1 dominante kaart `Komende risico's`
4. 1 dominante kaart `Beste actie vandaag`
5. compact blok `Reserves & buffer`
6. pas daarna optionele context zoals `Verwacht eindsaldo`, concrete `Komende momenten` of korte uitleg
