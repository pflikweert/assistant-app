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
- niet gericht op zakelijk gebruik

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
  - als dit nog onduidelijk is, moet dit expliciet benoemd worden vóórdat er gebouwd wordt
- Hero-offset en topbar-offset horen bij de shell, niet bij losse schermen:
  - gebruik voor hoofdschermen dezelfde topbarpositie als `Transactions` als referentie
  - gebruik de standaard hero-offset uit de gedeelde hero-component
  - voeg geen schermspecifieke hero `paddingTop`-overrides toe tenzij er aantoonbaar een afwijkende shell nodig is
  - als een afwijking echt nodig is, documenteer die expliciet in `docs/UI_PATTERNS.md`
- Utility-schermen met hero gebruiken onder de hero dezelfde gecentreerde contentkolom (`max-width`) als hoofdschermen; voorkom full-width content op web/desktop

## Shell-beslisregel

Voordat een nieuw scherm wordt gebouwd, moet expliciet bepaald worden of het een:

- `hoofdscherm`
- `utility/subscherm`

is.

Beslisregel:

- gebruik `hoofdscherm` alleen als het scherm een primaire navigatiefunctie heeft in de app
- gebruik `utility/subscherm` voor detail, beheer, modal, selectie, create/edit en ondersteunende flows
- combineer deze shells niet binnen één scherm
- als een scherm tussen beide in lijkt te zitten, analyseer eerst bestaande navigatie, gebruikersdoel en patroon in de codebase, en benoem de gemaakte keuze expliciet

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

Gebruik deze termen consistent. Introduceer geen nieuwe termen als de bestaande producttaal al volstaat.

## Verwachting Per Taak

Bij elke taak:

1. analyseer eerst het bestaande patroon in de code
2. hergebruik bestaande componenten, services en terminologie waar logisch
3. maak de kleinst mogelijke wijziging die het probleem oplost
4. benoem risico's als geldlogica, forecast, import, dedupe of categorisatie geraakt wordt
5. noem welke bestanden aangepast moeten worden
6. geef kort aan hoe de wijziging handmatig geverifieerd kan worden

## Verplichte Output Per Taak

Bij elke wijziging moet het antwoord deze structuur hebben:

1. **Analyse van bestaand patroon**
   - welke bestaande componenten, services, helpers of UI-patronen relevant zijn
   - of het huidige gedrag waarschijnlijk legacygedrag of een bewuste productkeuze is

2. **Voorgestelde wijziging**
   - wat er precies verandert
   - waarom dit de kleinst mogelijke logische oplossing is

3. **Bestanden**
   - welke bestanden aangepast moeten worden
   - welke nieuwe bestanden alleen echt nodig zijn als hergebruik niet logisch past

4. **Risico's**
   - of saldo, budget, forecast, import, dedupe, categorisatie of abonnementen geraakt worden
   - welke regressies kunnen ontstaan

5. **Handmatige verificatie**
   - welke gebruikersflow gecontroleerd moet worden
   - wat zichtbaar of functioneel correct moet zijn

6. **Tests**
   - welke bestaande tests relevant zijn
   - welke nieuwe tests nodig zijn als financiële logica of matching verandert

Geef geen codewijzigingen zonder eerst deze analyse te doen.

## Bronnen Van Waarheid

Gebruik deze volgorde bij twijfel:

1. bestaande werkende businesslogica in services en dataflows
2. dit playbook
3. `docs/UI_PATTERNS.md` voor UI-patronen, kleuren en designbeslissingen
4. schermspecifieke bestaande patronen in de codebase
5. open taken in `OPEN_TAKEN_FINANCE_APP.md`

Als iets in code en playbook lijkt te botsen, analyseer eerst of de code legacygedrag bevat of een bewuste productkeuze is. Verander dit niet zomaar zonder dit expliciet te benoemen.

## Databronnen En Verantwoordelijkheid

- database- en querylaag zijn leidend voor ruwe transactiedata
- services bepalen normalisatie, matching, forecast en andere afgeleide financiële logica
- UI presenteert uitkomsten, maar bedenkt geen eigen financiële waarheid
- formattering, labels en terminologie moeten uit gedeelde helpers of bestaande patronen komen
- verplaats geen financiële betekenis of afleiding naar losse schermcomponenten als dat in services hoort

## Financiële Logica Is Conservatief

Bij twijfel in geldlogica:

- toon liever minder slimme afleiding dan een mogelijk onjuiste conclusie
- presenteer forecast altijd als verwachting, niet als zekerheid
- maak onderscheid tussen bekende transacties, herkende patronen en aannames
- voorkom dat UI-copy meer zekerheid suggereert dan de data ondersteunt
- rond bedragen, datums en periodes consistent af volgens bestaande formattering en services
- verander geen semantische betekenis van bestaande bedragen of velden zonder dit expliciet te benoemen

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
- houd `Insights` als rustige scrollpagina zonder extra subnavigatie bovenaan
- zet maandkeuze direct onder de hero als maandcontext voor alle insight-blokken
- zorg dat `Wat valt op` nooit stilvalt door alleen timingfilters:
  - gebruik repeat suppression met activiteitssignaal (laatste transactiedatum)
  - toon altijd een zinvolle fallbackkaart bij weinig data of stabiele maand
- maak `Komende momenten` betekenisvol en categorie-gedreven:
  - toon liever geen kaart dan een vage bedrijfsnaam zonder besliswaarde
  - gebruik echte transactielabels, categorieën en budgetgroepcontext als bron voor titel en subtitel
  - als forecast- of timeline-data onvoldoende concreet is, toon een nette empty state in plaats van generieke fallbackkaarten
  - houd reads en writes schema-safe als forecast referentievelden nog niet overal beschikbaar zijn

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
- Gebruik bij forecast- en insight-vertaling geen fuzzy matching als de echte categorie-, referentie- of transactiedata beschikbaar is

## Insight-Signalen En AI-Invloeden

- Voor `Wat valt op` en vergelijkbare samenvattingsblokken geldt: bouw selectie, confidence, dedupe, fingerprint en herhaalonderdrukking altijd in een gedeelde service of selector, niet in de schermcomponent
- Label elke kandidaat expliciet als `hard` of `ai-influenced` zodat zichtbaar blijft welke signalen direct uit data komen en welke upstream beïnvloed zijn
- Toon alleen kaarten boven de afgesproken confidence-drempel; kleine verschillen horen niet op hoofdniveau
- Dedupe op semantische betekenis, niet alleen op technische family of id, zodat inhoudelijk vergelijkbare kaarten niet dubbel terugkomen
- Onderdruk herhaling over dagen via persistente history per gebruiker en maand, zodat dezelfde betekenis niet statisch blijft voelen
- Maak herhaalonderdrukking activiteit-aware:
  - als er in de gekozen maand geen recente transactiemutaties zijn, versoepel suppressie zodat het blok niet leeg blijft
  - historische maanden blijven inzichten tonen op basis van maandcontext, niet op basis van "vandaag"
- Als een insight-blok op meer dan één scherm terugkomt, moet dezelfde gedeelde logica en dezelfde tests worden gebruikt
- Voor forecastgedreven blokken zoals `Komende momenten` geldt extra:
  - gebruik duidelijke labels uit transacties en categorieën
  - kies liever een lege staat dan generieke koppen zoals `volgend verwacht moment`
  - als referentievelden schema-afhankelijk zijn, laat de app veilig terugvallen op legacy reads/writes totdat de migratie bevestigd is

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
- Als een insight-, summary- of signaalblok regelgebaseerd of AI-beïnvloed is, maak de selector/service direct gedeeld en voeg confidence- en repeat-suppressietests toe
- Houd tijdelijke scherm-specifieke styling klein en verwijder die weer zodra het patroon is gecentraliseerd
- Nieuwe schermen moeten standaard starten vanuit de juiste shell-keuze; voorkom dat een utility-scherm per ongeluk een hoofdscherm-shell krijgt of andersom
- Voor header/hero-ritme geldt: eerst component-default aanpassen, pas daarna scherm-overrides overwegen
- Als op meerdere pagina's dezelfde hero-offset gewenst is, wijzig de gedeelde hero-component en verwijder tijdelijke scherm-overrides
- Gebruik voor transactielijsten één gedeelde rijcomponent en één gedeeld lijstblok als patroon; schermen leveren alleen inhoud (titel, datum/meta, bedrag, acties)
- Gebruik voor budget-voortgang één gedeelde progressbar-component in plaats van losse inline balken
  - kleurcontract:
    - `good`: `#10b981`
    - `watch`: geel (theme accent)
    - `critical`: rood (theme danger)
- Vermijd technische labels in zichtbare UI-copy; kies begrijpelijke termen voor brede doelgroep (bijv. `Betaald via` i.p.v. `Betaalmethode` wanneer dat duidelijker is)

## Vermijd Altijd

- introduceer geen nieuwe terminologie als bestaande producttaal al volstaat
- maak geen brede refactor als een kleine gerichte wijziging voldoende is
- dupliceer geen bestaande shell-, hero-, card-, filter- of lijstpatronen
- verplaats geen businesslogica naar UI-componenten
- verander geen financiële betekenis van bestaande velden zonder dit expliciet te benoemen
- voeg geen visuele nadruk toe aan informatie die niet helpt bij een beslissing
- los performanceproblemen niet eerst op met lokale caches als query- of datalogica de echte oorzaak is
- maak geen schermspecifieke style-overrides als hetzelfde via gedeelde componenten opgelost moet worden
- bouw geen hybride schermen die tegelijk hoofdscherm- en utility-gedrag mengen
- voeg geen technische of Engelstalige copy toe in zichtbare UI als de rest van de flow Nederlandstalig en gebruiksvriendelijk is

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
- Als een vervolgverbetering bewust buiten scope blijft, zet die in `OPEN_TAKEN_FINANCE_APP.md`

## Taal

- De app is Nederlandstalig
- Vermijd zichtbare technische afkortingen als die voor eindgebruikers geen waarde hebben
- Schrijf copy kort, duidelijk en actiegericht

## Bij categorie-overzichten op Insights geldt:

- voor afgeronde maanden toon categorieën op basis van werkelijke uitgaven
- voor de lopende maand toon categorieën op basis van verwachte maanduitgaven
- verwachte maanduitgaven mogen bestaan uit:
  - geplande vaste lasten
  - herkende abonnementen
  - budgetgebaseerde verwachting voor variabele categorieën
- maak in de UI altijd duidelijk of een bedrag werkelijk, gepland of verwacht is
- presenteer de lopende maand niet alsof alle categorie-uitgaven al definitief zijn

## Voortgang

- Gebruik `OPEN_TAKEN_FINANCE_APP.md` als centrale backlog voor open product- en implementatietaken
- Nieuwe openstaande vervolgpunten of bewust uitgestelde verbeteringen moeten daar direct aan toegevoegd worden
- Houd die lijst bijgewerkt als een fase afgerond is of als de prioriteit wijzigt
