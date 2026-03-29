# Project Playbook

## App In 1 Zin

Dit is de dagelijkse financiële cockpit die huishoudens zonder vaktaal laat zien waar ze staan, wat eraan komt, wat veilig kan en wat nu de slimste volgende stap is.

## Wat De App Doet

- toont actuele rekeningstand, `Nu vrij` en `Veilig tot volgende inkomen`
- helpt gebruikers direct begrijpen wat veilig kan en wat aandacht vraagt
- vertaalt week- en maandsturing naar concrete beslissingen
- analyseert transacties en categoriseert uitgaven
- herkent abonnementen en vaste lasten
- maakt forecasts met cashflow-, reserve- en risicosignalen
- geeft rustige, duidelijke feedback en de beste volgende actie
- gebruikt AI als contextuele `Money Copilot`, niet als los chatproduct
- De volledige actuele featurekaart staat in `docs/BUDIO_FUNCTIONALITEITEN.md`. Werk die bij als we nieuwe functionaliteiten toevoegen of bestaande wijzigen.

## Doelgroep

- van tiener tot en met bejaarden
- niet gericht op zakelijk gebruik

## Productprincipes

- Toon eerst de huidige stand, daarna de beschikbare ruimte, daarna trend of risico, daarna advies
- Maak van home het dominante productmoment; andere schermen zijn ondersteunend tenzij expliciet anders onderbouwd
- Zet beslissingen boven categorieën, beheeropties of interne mechaniek
- `safe to spend` en `veilig tot volgende inkomen` zijn kernvragen van het product
- Gebruik AI context-first op het juiste moment; maak van chat geen primaire productidentiteit
- Kies productcompressie boven productexplosie: liever één absurd sterk antwoord dan vijf losse oppervlakken
- Laat geen dubbele of niet-relevante data op hetzelfde niveau zien
- Maak altijd duidelijk wat klikbaar is en wat een detailniveau is
- Houd taal en copy begrijpelijk voor niet-technische gebruikers
- Als iets geen beslissing helpt, hoort het waarschijnlijk niet op het hoofdniveau

## Nieuwe Productkoers

Vanaf 29 maart 2026 is de repo-richting expliciet:

- van budgetapp naar dagelijkse financiële cockpit
- van schermdenken naar één dominante home-ervaring
- van observeren naar veilige ruimte, komende risico's en beste volgende actie
- van losse AI-feature naar contextuele `Money Copilot`

Gebruik `docs/BUDIO_PRODUCTVISIE_ROADMAP.md` als expliciete productbron voor deze koers.

## Productcontract

Voor harde productbetekenis en truth hierarchy gelden aanvullend:

- `docs/BUDIO_PRODUCT_CONTRACT.md`
- `docs/BUDIO_COCKPIT_MIGRATION_MAP.md`

Bij conflict tussen producttaal en bestaande schermstructuur:

1. behoud eerst bestaande financiële waarheid
2. volg daarna het productcontract
3. gebruik de migration map om te bepalen wat behouden, aanpassen, samenvouwen of afbouwen is

## Anti-Bloat Regels

- home is het primaire beslisscherm
- elk ander scherm voedt of verdiept home
- AI introduceert geen nieuwe waarheid, maar legt bestaande financiële waarheid uit
- voeg geen nieuw scherm toe zonder sterke reden en expliciete cockpitwaarde
- productcompressie gaat boven featuregroei
- voeg geen nieuw primair home-signaal toe als het niet helpt bij stand, veilige ruimte, risico of volgende actie

## Migratieregel

- verander nog geen interne route- of servicenames puur om producttaal te laten aansluiten
- leg eerst productcontract en beslisarchitectuur vast
- doe daarna pas selectieve code-refactors waar de cockpitarchitectuur dat echt vraagt
- verwijder bestaande waardevolle richtlijnen niet zonder expliciete conflictmapping

## Design Richting

- Voor designwerk lees je altijd eerst `docs/design/design-system-rules.md`, daarna `docs/design/screen-inventory.md`, en daarna `docs/UI_PATTERNS.md`
- Voor UI-patronen, kleuren, spacing, typografie, headers, cards, filters, detailopbouw en mobile-first ontwerpkeuzes is `docs/UI_PATTERNS.md` de primaire visuele referentie
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
- Modals, sheets en selectorflows horen ook bij de shell:
  - gebruik voor bottom-sheet en selectorflows de gedeelde modal-shell als basis
  - centraliseer backdrop, sheet-radius, handle, close-knop, footer en scrollgedrag
  - modal shells mogen per flow alleen inhoud en beperkte accentkleuren aanpassen
  - nieuwe picker- of selectieflows mogen geen eigen losse sheet-rand of backdrop opnieuw uitvinden

## Design Workflow Voor Schermen

- Lees altijd eerst `docs/design/design-system-rules.md`
- Lees daarna `docs/design/screen-inventory.md`
- Voor Stitch-integratie vanuit Codex: volg `docs/design/stitch-codex-workflow.md`
- Raadpleeg daarna `docs/UI_PATTERNS.md` en pas bestaande patronen toe voordat je iets nieuws ontwerpt
- Behoud bestaande businesslogica, services en routing; designwerk mag geen nieuwe financiële waarheid introduceren
- Refactor UI in kleine stappen en centraliseer terugkerende patronen zo vroeg mogelijk
- Gebruik bestaande tokens, helpers en componenten waar mogelijk
- Voeg geen nieuwe dependencies toe zonder duidelijke noodzaak
- Bouw geen desktop-web layout als het scherm mobile-first bedoeld is
- Maak loading, empty, partial en error states expliciet
- Gebruik design-governance checks (`design:check`) voordat je grotere UI-refactors afrondt
- Als een route nog niet in de screen inventory staat, voeg die eerst toe of markeer hem expliciet als legacy, utility of structural
- Als Stitch MCP niet beschikbaar lijkt in de sessie: run `npm run stitch:codex:setup`, herstart sessie, en gebruik zonodig `npm run stitch:tool -- ...` als fallback
- Bij designwerk moet het antwoord altijd noemen:
  1. welke bestanden worden aangepast
  2. welke risico's er zijn
  3. hoe handmatig getest wordt

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

- `dagelijkse financiële cockpit`: de dominante home-ervaring die in één oogopslag rust, veilige ruimte, risico en volgende actie toont
- `actuele rekeningstand`: huidige bekende saldo of stand op basis van beschikbare rekeningdata
- `variabel budget`: ruimte voor niet-vaste uitgaven binnen de relevante periode
- `veilig te besteden`: bedrag dat nu verantwoord kan worden uitgegeven binnen de actuele context
- `veilig tot volgende inkomen`: ruimte die overblijft tot het volgende verwachte inkomensmoment
- `beste volgende actie`: de meest logische concrete stap die nu helpt om rust, ruimte of herstel te vergroten
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
3. toets eerst of de wijziging home, veilige ruimte, risico-uitleg of beste volgende actie sterker maakt
4. maak de kleinst mogelijke wijziging die het probleem oplost
5. benoem risico's als geldlogica, forecast, import, dedupe of categorisatie geraakt wordt
6. noem welke bestanden aangepast moeten worden
7. geef kort aan hoe de wijziging handmatig geverifieerd kan worden

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
3. `docs/BUDIO_PRODUCT_CONTRACT.md` voor begrippen, truth hierarchy en beslisregels
4. `docs/BUDIO_COCKPIT_MIGRATION_MAP.md` voor product- en domeinmigratie
5. `docs/BUDIO_PRODUCTVISIE_ROADMAP.md` voor productrichting, prioritering en cockpit-keuzes
6. `docs/BUDIO_FUNCTIONALITEITEN.md` voor de actuele functionele kaart en producttaal
7. `docs/UI_PATTERNS.md` voor UI-patronen, kleuren en designbeslissingen
8. schermspecifieke bestaande patronen in de codebase
9. open taken in `OPEN_TAKEN_FINANCE_APP.md`

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
- de oplossing past binnen het cockpit-productcontract
- relevante geldlogica consistent blijft tussen Dashboard, Budget en Insights
- bestaande patronen niet onnodig zijn doorbroken
- lint en relevante tests logisch zouden slagen
- regressierisico's benoemd zijn als financiële logica geraakt wordt
- de UI duidelijker of bruikbaarder is geworden voor de eindgebruiker

## Acceptance Checklist Voor Nieuwe Taken

- helpt dit de gebruiker weten waar hij nu staat?
- helpt dit veilige ruimte bepalen?
- helpt dit komende risico's begrijpen?
- helpt dit de beste volgende actie kiezen?
- zo niet, waarom hoort het dan in Budio?

## Verificatie

Gebruik waar relevant bestaande projectcommando's om werk te controleren, zoals:

- lint
- typecheck
- test
- relevante feature-specifieke checks

Voer geen zware of risicovolle commando's uit zonder noodzaak.

## Help Assistant Eval Tools

- Voor DB-grounded Help Assistant validatie bestaat een live eval-harness:
  - `npm run test:help-assistant-eval`
  - optioneel begrenzen met `HELP_ASSISTANT_EVAL_LIMIT=50`
  - schrijft rapport weg naar `tmp/help-assistant-live-eval-report.json`
- Voor snelle merchant-inspectie bestaat een service-role hulpmiddel:
  - `npm run help-assistant:list-merchants -- <userId> <startIso> <endIsoExclusive> <limit>`
  - voorbeeld: `npm run help-assistant:list-merchants -- 08c9f32b-ed7b-45d6-94b5-bb2fefadc89c 2026-03-01 2026-04-01 25`
- Voor zoeken in de categoriecatalogus bestaat een service-role hulpmiddel:
  - `npm run help-assistant:search-categories -- roken`
  - toont key, label en pad in de categorieboom
- Gebruik deze tools bij voorkeur vóór nieuwe heuristische fixes in routing of hydration, zodat matching eerst aan echte databasefeiten gespiegeld wordt.

## UX Richtlijnen Per Scherm

### Dashboard

- Dashboard is het primaire cockpit-scherm van Budio
- laat direct zien:
  - `Nu vrij`
  - `Veilig tot volgende inkomen`
  - `Komende risico's`
  - `Beste actie vandaag`
  - `Verwacht eindsaldo`
- houd positieve feedback kort en motiverend
- vermijd doorverwijzingsdenken; home moet eerst zelf antwoord geven
- laat analyseblokken alleen door als ze de beslissing van vandaag scherper maken

### Transactions

- focus op scanbaarheid, zoeken en snelle correctie
- toon categorie, status en abonnementskoppeling duidelijk
- gebruik filters en maandkeuze zonder overload
- bankrekeningfilters tonen alleen actieve rekeningen; gearchiveerde rekeningen verschijnen niet als filteroptie

### Budget

- gebruik `Budget` als ondersteunende motor voor veilige ruimte en sturing, niet als primaire productidentiteit
- scheid dagsturing, maandsturing en beheer
- maak overlapweken en maandgrenzen expliciet
- houd toekomstige maanden logisch en voorspelbaar

### Insights

- gebruik dit scherm voor trends, forecast, risico en uitleg achter de cockpit
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
- bij `Categorie wijzigen`:
  - bied een duidelijke keuze tussen `Via AI` en `Handmatig`
  - zorg dat `Via AI` bij bevestigen dezelfde geselecteerde opties kan toepassen als handmatig
  - houd het categoriezoekveld compact en vast bovenaan (niet meescrollen)

### Subscriptions

- houd create, edit en matching visueel gelijk
- vermijd jargon waar een gewone gebruiker het niet nodig heeft
- laat de gebruiker regels en gekoppelde betalingen duidelijk zien

## Technische Werkafspraken

- Gebruik bestaande componenten en services opnieuw voordat je iets nieuws maakt
- Nieuwe motion-, animation- en shared motion hooks horen onder `components/motions`; hergebruik die map eerst voordat je een nieuw motion-patroon toevoegt
- Houd rekenlogica en UI-copy consistent tussen `Budget`, `Insights` en `Dashboard`
- Als je financiële logica wijzigt, controleer ook de downstream impact op forecast, budget en transactielijsten
- Vermijd local caches als dezelfde verbetering beter in database of query-optimalisatie opgelost kan worden
- Normalizeer import- en details-strings consequent, vooral legacy `|`-varianten
- Wees voorzichtig met semantische betekenissen zoals `variabel budget`, `trend`, `budgetplan`, `op schema`, `let op` en `boven tempo`
- Gebruik bij forecast- en insight-vertaling geen fuzzy matching als de echte categorie-, referentie- of transactiedata beschikbaar is
- Voor web drag & drop in Expo Router / React Native Web:
  - vertrouw niet blind op alleen RN `onDrop` props op `View`
  - gebruik waar nodig DOM-listeners op web met expliciete `preventDefault`/`stopPropagation`
  - accepteer bestanden alleen binnen het bedoelde dropdoel (hit-test)

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
- Gebruik voor bottom-sheet modals en selectorflows bij voorkeur `components/ui/finance-bottom-sheet-shell.tsx` als gedeelde basis, en bouw content daarboven als losse gedeelde modalcomponent
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
- Voor elke commit is het verplicht om alle unit tests te draaien (`npm run test:unit`), inclusief nieuw toegevoegde tests in de huidige wijziging
- Doe handmatige verificatie als een wijziging saldo, forecast of importgedrag raakt
- Plaats Vitest testbestanden niet onder `app/` (Expo Router map), maar in een niet-route map zoals `services/` of `components/`

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
- Houd de fasering uit `docs/BUDIO_PRODUCTVISIE_ROADMAP.md` leidend; redesign- of polishwerk is alleen prioriteit als het de cockpitkoers direct ondersteunt
