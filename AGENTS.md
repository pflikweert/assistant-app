# Project Playbook

## App In 1 Zin

Dit is een mobiele finance-app voor overzicht, sturing en voorspelling van persoonlijke geldstromen.

## Wat De App Doet

- toont actuele rekeningstand en variabel budget
- helpt week- en maandsturing begrijpen
- analyseert transacties en categoriseert uitgaven
- herkent abonnementen en vaste lasten
- maakt forecasts met cashflow- en risicosignalen
- geeft rustige, duidelijke feedback die gebruikers helpt betere keuzes te maken

## Doelgroep

- van tiener tot en met bejaarden
- Niet gericht op zakelijk gebruik

## Productprincipes

- Toon eerst de huidige stand, daarna de beschikbare ruimte, daarna trend of risico, daarna advies
- Laat geen dubbele of niet-relevante data op hetzelfde niveau zien
- Maak altijd duidelijk wat klikbaar is en wat een detailniveau is
- Houd taal en copy begrijpelijk voor niet-technische gebruikers
- Als iets geen beslissing helpt, hoort het waarschijnlijk niet op het hoofdniveau

## Design Richting

- Voor UI-patronen, kleuren, spacing, typografie, headers, cards, filters, detailopbouw en mobile-first ontwerpkeuzes is `docs/UI_PATTERNS.md` de primaire designreferentie
- Basispalet blijft wit, grijs en zwart met geel als spaarzaam functioneel accent, zoals uitgewerkt in `docs/UI_PATTERNS.md`
- Pas bestaande Stitch-afgeleide patronen uit `docs/UI_PATTERNS.md` toe voordat je nieuwe visuele patronen introduceert
- Als een scherm bewust afwijkt van `docs/UI_PATTERNS.md`, benoem dan expliciet waarom dat productmatig of technisch nodig is
- Nieuwe visuele patronen eerst als gedeelde component of style-module bouwen; pas daarna op schermniveau invullen
- Laat shell-elementen die op meerdere schermen terugkomen nooit per scherm opnieuw uitvinden, maar centraliseer ze direct
- Bij nieuwe schermen eerst bepalen: is dit een hoofdscherm of een utility/subscherm?
  - hoofdscherm: gebruikt de gedeelde app-shell met topbar, hero en docked quick menu
  - utility/subscherm: gebruikt een compacte detail- of modal-shell zonder hoofdscherm-dock
  - als dit nog onduidelijk is, moet de vraag expliciet gesteld worden voordat er gebouwd wordt
- Hero-offset en topbar-offset horen bij de shell, niet bij losse schermen:
  - gebruik voor hoofdschermen dezelfde topbarpositie als `Transactions` als referentie
  - gebruik de standaard hero-offset uit de gedeelde hero-component
  - voeg geen schermspecifieke hero `paddingTop`-overrides toe tenzij er aantoonbaar een afwijkende shell nodig is
  - als een afwijking echt nodig is, documenteer die expliciet in `docs/UI_PATTERNS.md`
- Utility-schermen met hero gebruiken onder de hero dezelfde gecentreerde contentkolom (`max-width`) als hoofdschermen; voorkom full-width content op web/desktop.

## Kernbegrippen

- `actuele rekeningstand`: huidige bekende saldo of stand op basis van beschikbare rekeningdata
- `variabel budget`: ruimte voor niet-vaste uitgaven binnen de relevante periode
- `forecast`: verwachte ontwikkeling van saldo of beschikbare ruimte op basis van bekende inkomsten, vaste lasten en patronen
- `vaste lasten`: terugkerende, min of meer voorspelbare verplichtingen
- `abonnement`: herkende terugkerende betaling met relatie tussen transacties
- `trend`: richting of patroon in uitgaven of saldo-ontwikkeling, geen momentopname
- `op schema`: gebruiker zit binnen verwacht of gepland patroon
- `boven tempo`: gebruiker geeft sneller uit dan logisch is voor de periode
- `let op`: signaal dat context of actie vraagt, maar niet per definitie kritiek is

## Verwachting Per Taak

Bij elke taak:

1. analyseer eerst het bestaande patroon in de code
2. hergebruik bestaande componenten, services en terminologie waar logisch
3. maak de kleinst mogelijke wijziging die het probleem oplost
4. benoem risico's als geldlogica, forecast, import, dedupe of categorisatie geraakt wordt
5. noem welke bestanden aangepast moeten worden
6. geef kort aan hoe de wijziging handmatig geverifieerd kan worden

## Bronnen Van Waarheid

Gebruik deze volgorde bij twijfel:

1. bestaande werkende businesslogica in services en dataflows
2. dit playbook
3. `docs/UI_PATTERNS.md` voor UI-patronen, kleuren en designbeslissingen
4. schermspecifieke bestaande patronen in de codebase
5. open taken in `OPEN_TAKEN_FINANCE_APP.md`

Als iets in code en playbook lijkt te botsen, analyseer eerst of de code legacygedrag bevat of een bewuste productkeuze is. Verander dit niet zomaar zonder expliciet te benoemen.

## Done When

Een wijziging is pas klaar als:

- de oplossing past binnen bestaande producttaal en designrichting
- relevante geldlogica consistent blijft tussen Dashboard, Budget en Insights
- bestaande patronen niet onnodig zijn doorbroken
- lint en relevante tests logisch zouden slagen
- regressierisico's benoemd zijn als financiële logica geraakt wordt
- de UI duidelijker of bruikbaarder is geworden voor de eindgebruiker

## Verificatie

Gebruik waar relevant bestaande projectcommando's om werk te controleren, zoals:

- lint
- typecheck
- test
- relevante feature-specifieke checks

Voer geen zware of risicovolle commando's uit zonder noodzaak.

## UX Richtlijnen Per Scherm

### Dashboard

- laat saldo en vrij te besteden ruimte direct zien
- houd positieve feedback kort en motiverend
- vermijd analyseblokken die beter thuis horen in `Insights`

### Transactions

- focus op scanbaarheid, zoeken en snelle correctie
- toon categorie, status en abonnementskoppeling duidelijk
- gebruik filters en maandkeuze zonder overload

### Budget

- scheid dagsturing, maandsturing en beheer
- maak overlapweken en maandgrenzen expliciet
- houd toekomstige maanden logisch en voorspelbaar

### Insights

- gebruik dit scherm voor trends, forecast, risico en uitleg
- maak cashflow, budgetbasis en verwachting uit elkaar houdbaar
- toon duidelijke routes naar details en correcties

### Transaction Detail

- toon context eerst
- zet snelle correctie van categorie en abonnement bovenaan
- verberg technische metadata pas op tweede niveau

### Subscriptions

- houd create, edit en matching visueel gelijk
- vermijd jargon waar een gewone gebruiker het niet nodig heeft
- laat de gebruiker regels en gekoppelde betalingen duidelijk zien

## Technische Werkafspraken

- Gebruik bestaande componenten en services opnieuw voordat je iets nieuws maakt
- Houd rekenlogica en UI-copy consistent tussen `Budget`, `Insights` en `Dashboard`
- Als je financiële logica wijzigt, controleer ook de downstream impact op forecast, budget en transactielijsten
- Vermijd local caches als dezelfde verbetering beter in database of query-optimalisatie opgelost kan worden
- Normalizeer import- en details-strings consequent, vooral legacy `|`-varianten
- Wees voorzichtig met semantische betekenissen zoals `variabel budget`, `trend`, `budgetplan`, `op schema`, `let op` en `boven tempo`

## Data En Import

- Bij import eerst normaliseren, daarna dedupliceren
- Maak bij database-opruiming eerst een backup of dry-run plan
- Behoud bestaande transactiereferenties en koppelingen zoveel mogelijk
- Controleer altijd op impact voor abonnementen, categorisatie en forecast als je transacties aanpast

## Component En Code Structuur

- Houd schermspecifieke logica in het scherm, gedeelde logica in `services/`
- Gebruik gedeelde helpers voor formattering, normalisatie en matching
- Voeg nieuwe componenten alleen toe als hergebruik nergens logisch past
- Als een patroon op meerdere schermen terugkomt, centraliseer het zo vroeg mogelijk
- Als een UI-patroon al beschreven staat in `docs/UI_PATTERNS.md`, sluit daar dan eerst op aan voordat je een afwijkende componentstructuur kiest
- Als een shell-element op meerdere schermen terugkomt, maak er een gedeelde component of style-module van en hergebruik die direct
- Gebruik voor topbars en headers bij voorkeur `components/ui/finance-top-bar.tsx` als gedeelde basis, en pas alleen per scherm de title, right slot en children aan
- Pas quick menu-, tabbar-, topbar- en achtergronddecoratie-layouts op één centrale plek aan zodat alle schermen mee bewegen
- Ruim oude inline varianten op zodra een gedeelde component of module bestaat, zodat nieuwe schermen niet opnieuw dezelfde code krijgen
- Maak componenten bewust breder inzetbaar: stop stijl, spacing en shellgedrag in de component zelf; schermen leveren vooral inhoud en uitzonderingen aan
- Als een nieuwe stijl, hero, card, block, filter, modal of dock op 2 schermen nuttig blijkt, refactor hem direct naar een gedeeld component in dezelfde wijziging
- Houd tijdelijke scherm-specifieke styling klein en verwijder die weer zodra het patroon is gecentraliseerd
- Nieuwe schermen moeten standaard starten vanuit de juiste shell-keuze; voorkom dat een utility-scherm per ongeluk een hoofdscherm-shell krijgt of andersom
- Voor header/hero-ritme geldt: eerst component-default aanpassen, pas daarna scherm-overrides overwegen
- Als op meerdere pagina's dezelfde hero-offset gewenst is, wijzig de gedeelde hero-component en verwijder tijdelijke scherm-overrides
- Gebruik voor transactielijsten één gedeelde rijcomponent en één gedeeld lijstblok als patroon; schermen leveren alleen inhoud (titel, datum/meta, bedrag, acties).
- Vermijd technische labels in zichtbare UI-copy; kies begrijpelijke termen voor brede doelgroep (bijv. `Betaald via` i.p.v. `Betaalmethode` wanneer dat duidelijker is).

## QA En Tests

- Voeg tests toe bij wijzigingen in import, dedupe, budget, forecast, categorisatie of abonnementen
- Controleer regressies op huidige maand, toekomstige maand en overlapweken
- Test web-compatibiliteit als styling of navigation wrappers veranderen
- Houd lint en tests groen voor de bestanden die je aanpast
- Doe handmatige verificatie als een wijziging saldo, forecast of importgedrag raakt

## Werkstijl

- Maak gerichte wijzigingen en vermijd onnodig brede refactors
- Revert geen wijzigingen van de gebruiker of andere lopende taken
- Gebruik `apply_patch` voor handmatige edits
- Houd commits klein, inhoudelijk en logisch afgebakend
- Benoem risico's expliciet als een wijziging geld, forecast, dedupe of categorieën raakt

## Taal

- De app is Nederlandstalig
- Vermijd zichtbare technische afkortingen als die voor eindgebruikers geen waarde hebben
- Schrijf copy kort, duidelijk en actiegericht

## Voortgang

- Gebruik `OPEN_TAKEN_FINANCE_APP.md` voor open product- en implementatietaken
- Houd die lijst bijgewerkt als een fase afgerond is of als de prioriteit wijzigt
