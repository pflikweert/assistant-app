# UI Patterns

Deze gids legt de herbruikbare UI-patronen vast die zijn afgeleid uit `design_refs/stitch_v1` en getoetst zijn aan het actuele `Transactions`-scherm. Het doel is om nieuwe schermen rustiger, consistenter en mobiel sterker te maken zonder bestaande businesslogica of navigatiepatronen te verstoren.

## Algemene Designprincipes

- Werk mobile-first: eerst de verticale flow, daarna pas bredere web-layouts.
- Gebruik full-bleed achtergrondvlakken alleen voor hero- of sectie-ankers; houd inhoud zelf binnen een vaste, gecentreerde contentkolom.
- Basis is wit, warm grijs en zwart; geel is functioneel accent en geen dominante basiskleur.
- Geef primaire getallen, status en eerstvolgende actie de meeste visuele prioriteit.
- Vermijd drukke kaarten met te veel badges, lijnen of gelijkwaardige informatieblokken.
- Gebruik compactere topbars en laat grote schermtitels in de hero leven, niet dubbel in de content.
- Laat list rows scanbaar blijven: links context, midden betekenis, rechts bedrag of status.
- Gebruik segmenten, tabs en filterchips alleen als ze echt helpen bij een beslissing.
- Maak klikbaarheid zichtbaar via vorm, contrast en iconografie, niet via extra uitleg.
- Lege staten moeten richting geven: wat zie ik niet, waarom niet, en wat kan ik nu doen?
- Hero- en topbar-ritmiek is onderdeel van de shell: gelijke shell betekent gelijke verticale offset.

## Component-First Werkafspraken

- Bouw nieuwe UI eerst als herbruikbare component of style-module als het patroon op meer dan één scherm relevant kan zijn.
- Houd schermen zo dun mogelijk: schermen leveren inhoud, data en schermspecifieke uitzonderingen; componenten dragen layout, spacing en shellgedrag.
- Als je op één scherm een nieuwe hero, topbar, kaart, filter, dock of modal bedenkt die later elders kan terugkomen, centraliseer die direct in dezelfde wijziging.
- Ruim oude inline varianten meteen op zodra een gedeelde component bestaat, zodat we geen parallelle stylingpaden behouden.
- Verander terugkerende shell-elementen nooit alleen lokaal in één scherm als het een app-brede component hoort te zijn.
- Kies liever één sterke gedeelde implementatie met kleine props dan meerdere bijna-gelijke schermspecifieke varianten.
- Als een nieuwe uitzondering echt nodig is, documenteer die in de betreffende sectie van dit bestand.
- Pas hero-offset eerst in de gedeelde hero-component aan, niet met losse scherm-overrides.
- Verwijder tijdelijke scherm-overrides zodra de component-default klopt.

## Shell Offset Contract

- Doel: geen visuele sprongen tussen hoofdschermen met dezelfde shell.
- Regel:
  - hoofdschermen volgen `Transactions` als referentie voor topbar/hero-offset
  - hero-offset komt standaard uit `FinanceHeroShell`
  - per-scherm `innerStyle`-offsets zijn alleen toegestaan bij aantoonbaar afwijkende shell
- Implementatievolgorde:
  - 1. pas `FinanceHeroShell` of `FinanceTopBar` default aan
  - 2. verwijder lokale hero-offset overrides
  - 3. check hoofdschermen op gelijke bovenruimte
- QA-check:
  - vergelijk `Dashboard`, `Transactions`, `Settings`, `Subscriptions` op ruimte tussen topbar en hero-eyebrow
  - als de shell gelijk is maar de ruimte anders voelt, is dit een regressie

## Core Patterns

De onderstaande patronen vormen de vaste bouwstenen. Gebruik deze sectie als primaire referentie voor nieuwe schermen en redesigns.

### Patroon: Screen Layout

- Naam: Full-bleed shell met gecentreerde contentkolom
- Doel: schermen ruim en premium laten voelen zonder dat content op web uit elkaar valt
- Waar toepasbaar in de app: Dashboard, Transactions, Budget, Insights, Subscriptions, detailschermen met hero
- Structuur / opbouw:
  - vaste of sticky topbar
  - optioneel hero-vlak over volledige breedte
  - inhoud in een `max-width` kolom
  - lijst- of kaartsecties op basisachtergrond
  - bottom nav of FAB los van de content
- Belangrijkste visuele regels:
  - full-bleed achtergrond alleen voor hero of duidelijke sectie-ankers
  - contentkolom blijft gecentreerd
  - basisachtergrond rustiger dan hero-vlak
- Mobile-first aandachtspunten:
  - op mobiel gebruikt de contentkolom vrijwel volledige breedte met consistente horizontale padding
  - voorkom zij-aan-zij blokken die te vroeg naast elkaar springen
- Web/native aandachtspunten:
  - op web altijd een vaste `max-width` voor content
  - op native geen desktop-achtige gutters simuleren als het toestel die ruimte niet heeft
  - utility/detailschermen met hero volgen dezelfde regel: hero full-bleed mag, maar contentzone eronder blijft gecentreerd met vaste `max-width`
- Componentrichtlijn:
  - gebruik gedeelde shells voor backdrop, hero, topbar en dock
  - laat schermen niet zelf hun eigen layout-variant bouwen als dezelfde shell al bestaat
  - hero mag full-bleed zijn, maar hero-inhoud en vervolgcontent blijven in dezelfde gecentreerde contentkolom

### Patroon: Topbars / Headers

- Naam: Transparante compact header
- Doel: navigatie en context tonen zonder de contentvisuele hiërarchie te domineren
- Waar toepasbaar in de app: Transactions, Dashboard, Budget, Insights, modal-achtige tools
- Shared implementation: gebruik `components/ui/finance-top-bar.tsx` als basis, tenzij een scherm expliciet een native stack header nodig heeft.
- Structuur / opbouw:
  - vaste bovenbalk
  - links menu of terugactie
  - centraal of links product/schermtitel
  - rechts avatar of secundaire actie
- Belangrijkste visuele regels:
  - lichte transparantie
  - subtiele border onderaan
  - compacte hoogte
  - titel op appniveau klein houden
- Mobile-first aandachtspunten:
  - maximaal 1 primaire actie links en 1 rechts
  - laat de grote schermtitel in de hero of content leven
- Web/native aandachtspunten:
  - op web werkt translucency goed met backdrop-blur uitstraling
  - op native liever subtiel transparant dan te glazig als blur niet consistent is
- Componentrichtlijn:
  - hergebruik `components/ui/finance-top-bar.tsx` of een daarop gebaseerde variant
  - maak een nieuwe headercomponent alleen als de interaction of context echt fundamenteel afwijkt
  - houd topbarpositie en hero-offset consistent binnen dezelfde schermfamilie

### Patroon: Cards

- Naam: Zachte informatiedragers
- Doel: groepen informatie scheiden zonder zware dashboardsfeer
- Waar toepasbaar in de app: Budget categories, subscription items, info cards, suggestion blocks, summaries
- Structuur / opbouw:
  - afgeronde container
  - beperkte border of zachte schaduw
  - duidelijke inhoudsblokken met 1 primair anker
- Belangrijkste visuele regels:
  - grote radius
  - liever 1 subtiele border dan zware schaduw
  - hover of focus alleen licht versterken
- Mobile-first aandachtspunten:
  - inhoud stapelt verticaal
  - gebruik kaarten alleen als ze echt informatie groeperen
- Web/native aandachtspunten:
  - web kan iets meer lucht gebruiken
  - native moet kaarten niet te veel als desktop-panelen laten voelen
- Componentrichtlijn:
  - maak cardvarianten gedeeld zodra eenzelfde card op meerdere schermen terugkomt
  - gebruik geen unieke card-styling per scherm als de inhoud grotendeels hetzelfde is

### Patroon: Stat Blocks

- Naam: Kerngetal met context
- Doel: saldo, budget of maandtotaal direct leesbaar maken
- Waar toepasbaar in de app: Dashboard hero, Budget hero, subscription metrics, insights snapshots
- Structuur / opbouw:
  - eyebrow
  - groot kerngetal
  - kleine status of trendlabel
  - optioneel progress bar of vergelijkingsregel
- Belangrijkste visuele regels:
  - kerngetal is visueel dominant
  - secundaire informatie kleiner en rustiger
  - geel of groen alleen functioneel gebruiken
- Mobile-first aandachtspunten:
  - maximaal 1 dominant getal per blok
  - vergelijkingen of trends niet naast het getal proppen
- Web/native aandachtspunten:
  - op web kan een secundair blok naast het hoofdgetal
  - op native liever onder elkaar voor rust
- Componentrichtlijn:
  - stat blocks zijn bij voorkeur herbruikbare bouwstenen met wisselbare inhoud
  - bouw varianten voor kerngetal, secundair statblok en accentblok op dezelfde componentfamilie
  - budget-voortgangsbalken komen uit één gedeelde component (`FinanceBudgetProgressBar`) en niet uit schermspecifieke inline views
  - kleurcontract voor budgetprogress:
    - goed: `#10b981`
    - aandacht: geel accent
    - kritisch: rood

### Patroon: List Rows

- Naam: Scanbare financiële rij
- Doel: transacties en vergelijkbare items snel scanbaar maken
- Waar toepasbaar in de app: Transactions, recents op Dashboard, history in detailschermen, subscriptions lists
- Structuur / opbouw:
  - links icoon in zachte vorm
  - midden titel, omschrijving, categorie/context
  - rechts bedrag of status
- Belangrijkste visuele regels:
  - titel vet, omschrijving subtiel, metadata klein
  - negatieve bedragen neutraal donker, positieve bedragen groen
  - hover of press alleen licht
- Mobile-first aandachtspunten:
  - omschrijving mag 2 regels gebruiken
  - datum niet herhalen als de lijst al per dag gegroepeerd is
  - metadata terugbrengen tot wat het beslissen helpt
- Web/native aandachtspunten:
  - op web extra breedte niet vullen met ruis
  - op native bedragen rechts strak uitlijnen
- Componentrichtlijn:
  - maak rijen die per scherm terugkomen direct gedeeld, inclusief icon sizing en spacing
  - gebruik één rijcomponentfamilie voor transacties, historie en vergelijkbare lijstitems
  - combineer waar mogelijk een gedeeld `transactions block` + gedeelde `transaction row` zodat Dashboard, Transactions en Detail-historie niet divergeren

### Patroon: Utility Content Width

- Naam: Utility content in vaste kolom
- Doel: utility/detailschermen op web rustig en consistent houden met hoofdschermen
- Waar toepasbaar in de app: Transaction Detail, settings-achtige utilityschermen, modale detailflows met hero
- Structuur / opbouw:
  - topbar + hero mogen full-bleed
  - content onder hero in gecentreerde kolom (`max-width`)
- Belangrijkste visuele regels:
  - geen full-width tekstblokken op desktop onder een hero
  - spacing en ritme onder hero sluiten aan op Dashboard/Transactions
- Mobile-first aandachtspunten:
  - op mobiel blijft de kolom praktisch full-width met vaste horizontale padding
- Web/native aandachtspunten:
  - op web altijd `max-width` + `alignSelf: center` voor de contentlaag onder hero
  - op native geen extra kunstmatige marges toevoegen

### Copy Richtlijn: Begrijpelijke Labels

- Vermijd technisch jargon in zichtbare labels als het geen besliswaarde heeft.
- Gebruik termen die direct duidelijk zijn voor brede doelgroep.
- Voorbeeld:
  - liever `Betaald via` dan `Betaalmethode` als de bronrekening/betaalroute bedoeld is.

### Patroon: Filter Bars

- Naam: Compacte filter-launcher
- Doel: filterkracht bieden zonder een drukke top van het scherm
- Waar toepasbaar in de app: Transactions, Insights, Budget perioden, subscription filtering
- Structuur / opbouw:
  - 1 duidelijke filterknop of launcher
  - zoekveld los eronder
  - actieve filters als aparte chips onder de zoekactie
  - uitgebreid filterbeheer in sheet of modal
- Belangrijkste visuele regels:
  - actieve status mag klein zichtbaar zijn via badge of subtiele meta
  - filterrow moet rustig blijven
  - zoekveld visueel zachter dan primaire CTA
- Mobile-first aandachtspunten:
  - geef voorkeur aan modal/sheet boven veel chips naast elkaar
  - houd horizontale filtercarrousels beperkt
- Web/native aandachtspunten:
  - op web kan een bredere launcher meer context tonen
  - op native is een bottom sheet vaak natuurlijker dan een inline filterpaneel
- Componentrichtlijn:
  - maak de launcher, chips en modal/sheet samen onderdeel van één filterflow-componentset
  - wijzig filtervormgeving op één plek zodat alle schermen mee bewegen

### Patroon: Tabs / Segment Controls

- Naam: Beslissegment
- Doel: snel wisselen tussen inhoudstypen op hetzelfde niveau
- Waar toepasbaar in de app: filters op type, budgetcontexten, insight-onderdelen
- Structuur / opbouw:
  - capsule- of railcontainer
  - 2 tot 4 opties
  - 1 actieve optie met gevuld vlak
- Belangrijkste visuele regels:
  - actieve staat duidelijk, inactieve staten rustig
  - geen extra iconen tenzij die echt betekenis toevoegen
- Mobile-first aandachtspunten:
  - houd labels kort
  - maximaal 3 tot 4 segmenten op 1 rij
- Web/native aandachtspunten:
  - op web kan segment iets breder worden
  - op native moet touch target ruim genoeg blijven
- Componentrichtlijn:
  - segment controls alleen delen via een gezamenlijke component wanneer ze hetzelfde gedrag en dezelfde states delen

### Patroon: Bottom Navigation / Quick Menu

- Naam: Docked quick menu
- Doel: de belangrijkste schermen snel bereikbaar maken zonder dat de contenttop druk wordt
- Waar toepasbaar in de app: tab-based schermen, globale app-shells, snelle routes naar Dashboard, Budget, Transactions en Insights
- Structuur / opbouw:
  - afgeronde container met zachte schaduw of border
  - maximaal 4 primaire items
  - 1 actieve item met gevuld of sterk geaccentueerd vlak
  - label onder icoon of compacte pill-indicator
- Belangrijkste visuele regels:
  - dock voelt los van de content maar dicht op de onderrand
  - actieve staat gebruikt geel of een duidelijk functioneel accent
  - container blijft licht en compact, niet massief
- Mobile-first aandachtspunten:
  - min mogelijk tekst, geen extra secundaire uitleg
  - voldoende touch targets ondanks compacte vorm
  - op kleine schermen altijd de hoogte beperken
- Web/native aandachtspunten:
  - op web mag de dock iets zweven boven de onderrand
  - op native moet de dock ook zonder blur of translucency sterk genoeg zijn
- Componentrichtlijn:
  - pas dock layout, active state en hoogte altijd in de gedeelde quick-menu component aan
  - laat geen scherm eigen dock-variant behouden als het patroon overeenkomt

### Patroon: Status Labels / Pills

- Naam: Functionele statuspill
- Doel: status, risico of fase compact communiceren
- Waar toepasbaar in de app: budgetstatus, overlapweken, filters, abonnementstatus, alerts
- Structuur / opbouw:
  - korte tekst
  - optioneel klein puntje of icoon
  - afgeronde pillvorm
- Belangrijkste visuele regels:
  - geel voor focus of waarschuwing
  - groen voor positief of bevestigd
  - rood alleen voor echte problemen of destructieve context
- Mobile-first aandachtspunten:
  - statuspills mogen niet de hoofdinformatie verdringen
  - gebruik ze spaarzaam
- Web/native aandachtspunten:
  - op web kunnen meerdere pills naast elkaar
  - op native liever 1 duidelijke status per informatielaag
- Componentrichtlijn:
  - status pills zijn kleine herbruikbare tokens, geen losse schermspecifieke mini-cards

### Patroon: CTA Buttons

- Naam: Primaire en secundaire actie
- Doel: de volgende stap duidelijk maken zonder keuze-overload
- Waar toepasbaar in de app: hero’s, lege staten, modals, detailacties, importflows
- Structuur / opbouw:
  - primaire CTA gevuld
  - secundaire CTA outlined of neutraal
  - tertiaire actie als tekstlink of icoonactie
- Belangrijkste visuele regels:
  - primaire CTA gebruikt geel of donker contrast, niet willekeurig groen
  - afgeronde pillvorm voor hoofdacties
  - secundaire acties mogen rustiger zijn
- Mobile-first aandachtspunten:
  - 1 primaire CTA per blok
  - meerdere CTA’s onder elkaar of in simpele 2-up layout
- Web/native aandachtspunten:
  - op web kunnen CTA’s vaker inline naast elkaar
  - op native moeten touch targets groot genoeg blijven
- Componentrichtlijn:
  - primaire en secundaire actievarianten worden per app-shell consistent gehouden

### Patroon: Detail Layouts

- Naam: Context eerst, correctie daarna
- Doel: detailschermen begrijpelijk maken zonder technische overbelasting
- Waar toepasbaar in de app: Transaction Detail, subscription detail, insight detail
- Structuur / opbouw:
  - contexthero met naam, bedrag, datum of saldo
  - inhoudssectie met beschrijving, categorie en relevante toggles
  - actiegrid of CTA-blok
  - historie en metadata lager in de hiërarchie
- Belangrijkste visuele regels:
  - topgedeelte luchtig en gefocust
  - inhoudssectie voelt als rustige sheet op basisachtergrond
  - correctie-acties visueel gegroepeerd
- Mobile-first aandachtspunten:
  - plaats de belangrijkste correctie boven technische metadata
  - vermijd diepe accordionstructuren in de eerste viewport
- Web/native aandachtspunten:
  - op web kun je inhoudssecties iets breder of tweekoloms maken
  - op native vooral lineaire flow behouden
- Componentrichtlijn:
  - detailschermen gebruiken waar mogelijk dezelfde hero, topbar, card en text-block componenten
  - maak alleen detail-specifieke componenten voor daadwerkelijk afwijkende interaction patterns

### Patroon: Form Patterns

- Naam: Rustige invoervelden en keuzevakken
- Doel: formulieren en filterflows licht en duidelijk houden
- Waar toepasbaar in de app: imports, filters, instellingen, abonnementbeheer, datumselectie
- Structuur / opbouw:
  - label in uppercase microcopy
  - veld of keuzevlak daaronder
  - optionele helper of geselecteerde waarde
- Belangrijkste visuele regels:
  - velden op zachte achtergrond
  - focusstate duidelijk maar niet schreeuwerig
  - calendars, periodekiezers en selectors voelen als kaarten
- Mobile-first aandachtspunten:
  - gebruik sheets/modals voor complexere keuzes
  - laat invoervelden niet te klein worden
- Web/native aandachtspunten:
  - op web kan grid-layout bij formulieren
  - op native liever 1-kolomsflow met duidelijke verticale ritmiek
- Componentrichtlijn:
  - zet herbruikbare form controls en keuzevakken in gedeelde componenten zodra ze vaker terugkomen

### Patroon: Spacing / Padding / Rhythm

- Naam: Rustige verticale cadans
- Doel: schermen kalm en leesbaar laten voelen
- Waar toepasbaar in de hele app
- Structuur / opbouw:
  - topbar
  - hero of contextanker
  - filter/zoeklaag
  - inhoudssecties
  - footer of bottom nav
- Belangrijkste visuele regels:
  - hero krijgt de ruimste verticale padding
  - tussen secties zit duidelijke ademruimte
  - binnen kaarten is padding consistent
- Mobile-first aandachtspunten:
  - liever meer verticale dan horizontale variatie
  - voorkom kleine willekeurige ruimtes tussen vergelijkbare componenten
- Web/native aandachtspunten:
  - op web iets ruimere sectieruimte
  - op native compacte topbars, maar nooit gepropte content
- Componentrichtlijn:
  - spacing hoort bij de gedeelde shell of component, niet bij losse scherm-lokale uitzonderingen
  - houd ritme consistent door dezelfde padding- en gap-tokens te hergebruiken

### Patroon: Typography Hierarchy

- Naam: Zwitserse hiërarchie met rustige body copy
- Doel: informatieprioriteit direct voelbaar maken
- Waar toepasbaar in de hele app
- Structuur / opbouw:
  - eyebrow in uppercase microcopy
  - hero-title groot en zwaar
  - sectietitel kleiner maar nog duidelijk
  - body copy middelgroot
  - metadata en labels klein
- Belangrijkste visuele regels:
  - grote titels gebruiken strakke tracking en hoge impact
  - body copy blijft rustig en leesbaar
  - metadata gebruikt uppercase en letterspacing alleen voor labels, niet voor alles
- Mobile-first aandachtspunten:
  - behoud hiërarchie ook als titels afschalen
  - laat subcopy niet even belangrijk worden als titel of bedrag
- Web/native aandachtspunten:
  - op web kunnen hero-titels groter
  - op native moeten regels compact genoeg blijven voor kleine viewports
- Componentrichtlijn:
  - typografische schaal hoort in componenten of gedeelde tokens thuis, niet per scherm opnieuw gedefinieerd

### Patroon: Empty States / Feedback Blocks

- Naam: Richtinggevende lege staat
- Doel: uitleggen wat ontbreekt en wat de gebruiker nu kan doen
- Waar toepasbaar in de app: Transactions, imports, subscriptions, insights without data
- Structuur / opbouw:
  - herkenbaar icoon of eenvoudige illustratieve vorm
  - korte titel
  - uitleg in 1 tot 2 regels
  - primaire en secundaire vervolgstap
- Belangrijkste visuele regels:
  - veel witruimte
  - 1 duidelijke CTA
  - ondersteunende kaarten of trust blocks alleen als ze echt helpen
- Mobile-first aandachtspunten:
  - actie moet zonder extra scroll of denkwerk duidelijk zijn
  - voorkom te lange uitlegblokken
- Web/native aandachtspunten:
  - op web kunnen extra ondersteunende voordelen of contextkaarten onder de lege staat
  - op native vooral kort en actiegericht blijven
- Componentrichtlijn:
  - maak lege-staat blokken gedeeld zodra eenzelfde structuur op meerdere plekken terugkomt
  - houd primary/secondary CTA-ordes consistent

## Screen-specific Examples

Gebruik deze sectie als brug tussen de kernpatronen en concrete schermen in deze codebase.

### Transactions

Referentie:
- Stitch: `design_refs/stitch_v1/transacties_vereenvoudigd_overzicht_met_saldo`
- Code: [TransactionsScreen](/Users/pieterflikweert/development/assistant/screens/TransactionsScreen.tsx)

Toegepaste patronen:
- full-bleed hero-achtergrond met gecentreerde contentkolom
- transparante vaste topbar
- compacte filter-launcher met sheet/modal in plaats van een drukke filterrij
- rustige zoekbalk en actieve filterchips onder de hero
- list rows met icoon, 2-regelige omschrijving, categoriepad en bedrag rechts
- mobiele pager met compacte status en icon-navigatie
- docked quick menu als losse shell tegen de onderrand

Waarom dit scherm belangrijk is:
- dit is momenteel de beste productievertaling van Stitch naar de bestaande app-architectuur
- gebruik dit scherm als eerste implementatievoorbeeld voor lijsten, hero-opbouw, mobiele filtering en docked quick menu

### Budget

Referentie:
- Stitch: `design_refs/stitch_v1/budget_verbeterde_hero`

Belangrijkste patronen:
- full-bleed shell met compacte topbar en maandkiezers in de headerlaag
- hero met groot kerngetal en compacte statuslabel
- progress bars voor budgetverbruik
- tactische stat blocks onder de hero
- kaarten voor overlapweken en categorie-inzichten
- quick menu en topactie blijven visueel rustig, niet concurrerend met de hero

Wanneer hergebruiken:
- bij schermen waar dagsturing, maandsturing en signalering samenkomen

### Dashboard

Referentie:
- Stitch: `design_refs/stitch_v1/dashboard_verbeterde_hero`

Belangrijkste patronen:
- full-bleed hero met totaalstand en secundair budgetblok
- compacte topbar met appcontext en secundaire actie
- compacte status cards
- korte snapshot-lijsten in plaats van zware dashboards
- bottom quick menu blijft docked en licht
- gedeelde budgetprogressbalk voor zowel maand- als weekvoortgang

Wanneer hergebruiken:
- bij schermen die overzicht eerst en details pas daarna tonen

### Subscriptions

Referentie:
- Stitch: `design_refs/stitch_v1/abonnementen_verbeterde_hero`

Belangrijkste patronen:
- hero met maandtotaal en trendpill
- grote bento-achtige CTA- of insightkaart
- rijke lijstkaarten met meerdere statvelden

Wanneer hergebruiken:
- bij schermen met terugkerende verplichtingen, rijke itemkaarten en acties op kaartniveau

### Transaction Detail

Referentie:
- Stitch: `design_refs/stitch_v1/transactiedetail_compact_inzicht`

Belangrijkste patronen:
- contexthero met merchant, bedrag en datum
- sheet-achtige inhoudssectie
- actiegrid voor snelle correcties
- insight block en historie onderaan

Wanneer hergebruiken:
- voor detailschermen waar correctie en context belangrijker zijn dan technische metadata

### Filters En Datumkeuze

Referenties:
- Stitch: `design_refs/stitch_v1/filter_menu_compacte_periode_selectie`
- Stitch: `design_refs/stitch_v1/datum_kiezer_swiss_zen`

Belangrijkste patronen:
- filters in modal of sheet in plaats van inline overload
- duidelijke secties binnen de filterflow
- zachte veldkaarten en compacte segmenten
- primaire actie onderaan

Wanneer hergebruiken:
- voor periodes, categoriekeuzes en complexere filterflows op mobiel

### Empty States

Referentie:
- Stitch: `design_refs/stitch_v1/transacties_lege_status`

Belangrijkste patronen:
- grote centrale lege staat
- 1 primaire en 1 secundaire CTA
- optionele trust- of uitlegkaarten eronder op grotere schermen

Wanneer hergebruiken:
- wanneer een scherm zonder data anders leeg of technisch zou aanvoelen

## Gebruik in de app

- Gebruik eerst bestaande implementaties in code voordat je een nieuw patroon bouwt.
- Controleer of een patroon al vertaald is in `Transactions`, `Subscriptions` of `Transaction Detail`.
- Houd full-bleed achtergronden en gecentreerde contentkolommen consequent.
- Als een scherm afwijkt van deze patronen, benoem dan expliciet waarom dat productmatig nodig is.
