# Budio Stitch Design System

Dit document beschrijft de Stitch design-system richting voor Budio.  
Bron van waarheid blijft de codebase (`constants/theme.ts`) en de design docs in deze repo.

## 1. Productrichting

Budio is een rustige, mobile-first fintech UI.  
Volg deze hiërarchie op schermen:

1. huidige stand
2. beschikbare ruimte
3. risico of trend
4. advies of volgende stap

Vermijd visuele drukte, dubbele info en onduidelijke klikbaarheid.

## 1a. Home-Cockpit Contract

Voor Home geldt een expliciet strengere designhiërarchie dan voor andere schermen:

1. `Veilig tot volgende inkomen` is de primaire Home-hero of hoofdstat
2. `Nu vrij` is een secundaire stat binnen dezelfde cockpit-head
3. `Komende risico's` is een compact dominant decision block
4. `Beste actie vandaag` is een compact dominant decision block
5. `Reserves & buffer` is compact en ondersteunend

Contract:

- Home is geen klassiek dashboard met gelijkwaardige kaarten
- Home moet visueel sturen op rust, veiligheid en focus, niet op hoeveelheid informatie
- `Komende risico's` en `Beste actie vandaag` krijgen duidelijke prioriteit boven ondersteunende context
- `Reserves & buffer` mag niet even luid zijn als het hoofdgetal of de dominante decision blocks
- Home toont maximaal 1 dominante risicokaart en exact 1 dominante actiekaart
- subscription-optimalisatie hoort niet standaard in Home-risico's; alleen bij nabije aantoonbare cash-impact of tijdsgevoelig financieel risico

## 1b. Interne Beheerlagen Binnen Hoofdschermen

Voor hoofdschermen geldt aanvullend:

- een hoofdscherm mag een rustige interne beheerlaag hebben zonder een tweede hoofdschermgevoel te maken
- zo'n beheerlaag gebruikt utility-achtige groepskaarten, samenvattingsrijen en secundaire acties
- conditionele controls verschijnen alleen wanneer relevant en niet standaard open
- binnen Budget betekent dit dat `Beheer` maandruimte uitlegt via `Aanpak`, `Bronnen` en `Reserves / jaarlijkse lasten`
- `Maandverdeling` en `Categoriebudgetten` zijn daar ondersteunend en niet visueel dominant
- sheets blijven voor secundaire detailbewerking; de hoofdstructuur blijft in hetzelfde scherm

## 1c. Budget Segment `Beheer` Preview-Contract

Voor het Budget-segment `Beheer` (design-preview, zonder logicawijziging) geldt:

- positioneer het segment als rustige instel- en onderhoudslaag
- aanbevolen segmentlabel is `Aanpak`; als `Beheer` blijft staan, moet de interne opbouw alsnog starten met blok `Aanpak`
- vaste blokvolgorde:
  - `Aanpak`
  - `Bronnen`
  - `Reserves / jaarlijkse lasten`
- `Maandverdeling` blijft inhoudelijk aanwezig, maar als compacte samenvatting binnen `Bronnen`
- `Maandbudget per categorie` wordt secundair:
  - standaard ingeklapt
  - samengevat met status en tellingen
  - pas open bij expliciete actie
- forecastbron-informatie wordt subtiel:
  - korte helper/meta regel
  - geen losse dominante kaart
- `Reserves / jaarlijkse lasten` toont compact overzicht op hoofdniveau en gebruikt de bestaande sheet voor detailbeheer
- conditionele controls blijven strikt conditioneel:
  - spaardoel-control alleen zichtbaar bij `Aangepast`
  - geen standaard open detailpanelen zonder directe noodzaak

## 1d. Budget Instel-Flow Contract

Voor de nieuwe begeleide budget-instelflow geldt:

- het is een utility/subflow binnen Budget, geen vervanging van de Budget-tab
- de flow start met een hero-entry binnen Budgetbeheer en leidt eerst naar analyse, dan naar voorstel, dan naar verfijning
- het eerste scherm mag rust en richting geven, maar geen klassiek formuliergevoel oproepen
- AI kiest of adviseert de default strategie op basis van context; de gebruiker mag die strategie altijd overschrijven
- AI komt pas ná het voorstel als uitleg- en verfijnlaag, niet als chat-first startpunt
- lokale bewerkingen blijven secundair en gebruiken bestaande sheets of compacte detailflows
- de flow gebruikt alleen bestaande Budio-taal en existing design tokens; geen nieuwe visuele of producttaal

### Instapscherm

- doel: gebruiker snel laten kiezen tussen `Slim met Budio` en `Handmatig`
- hoofdsecties:
  - korte hero met uitleg dat Budio eerst een voorstel maakt
  - primaire CTA `Slim met Budio`
  - secundaire CTA `Handmatig`
  - compacte trustregel met wat Budio meeneemt in de analyse
- states:
  - loading: knop disabled en korte voorbereidingstekst
  - empty: geen budgetdata beschikbaar, maar wel route naar `Handmatig`
  - partial: voorstel kan al starten met beperkte brondata
  - error: hersteltekst en terugval naar `Handmatig`
  - success: flow start en analysefase opent

### Analysefase

- doel: inkomen, vaste lasten, reserveringen en variabele ruimte berekenen zonder open chat
- hoofdsecties:
  - progress of step indicator
  - korte statusregel per berekeningsstap
  - compacte achtergrondkaart met wat al bekend is
- primaire CTA: `Verder`
- secundaire CTA: `Terug`
- states:
  - loading: actieve berekening of herberekening
  - empty: nog geen brondata, route terug naar instap of `Handmatig`
  - partial: deel van de bronnen is beschikbaar, voorstel kan toch worden opgebouwd
  - error: herstartanalyse of terug naar budget
  - success: voorstel klaar om te tonen

### Voorstelscherm

- doel: één duidelijke budgetstrategie tonen die de gebruiker alleen hoeft te bevestigen of bij te sturen
- hoofdsecties:
  - voorgestelde strategie met label en korte uitleg
  - verwacht vrij te verdelen bedrag
  - 4 tot 5 voorgestelde variabele budgetcategorieën met bedragen
  - compacte uitleg waarom deze verdeling gekozen is
  - samenvatting van vaste lasten en reserveringen als context, niet als extra formulierveld
- primaire CTA: `Gebruik voorstel`
- secundaire CTA: `Pas aan`
- states:
  - loading: geen echte interactie, alleen skelet of berekende placeholders
  - empty: onvoldoende data voor voorstel, terugval naar `Handmatig`
  - partial: voorstel is conservatief opgebouwd met beperkte brondata
  - error: voorstel niet beschikbaar, hersteloptie of terug naar analyse
  - success: voorstel toegepast of bewaard als concept

### Verfijnfase

- doel: voorstel rustig aanscherpen met contextuele AI-uitleg als secundaire hulp
- hoofdsecties:
  - huidige strategie met mogelijkheid om die te wisselen
  - compacte AI-uitleg waarom de verdeling zo is gemaakt
  - kleine correctie-acties per blok of categorie
  - bevestigingsblok met wat er verandert als de gebruiker opslaat
- primaire CTA: `Opslaan`
- secundaire CTA: `Meer uitleg`
- states:
  - loading: AI of achtergronduitleg wordt opgebouwd
  - empty: geen voorstel beschikbaar, terug naar start of analyse
  - partial: voorstel staat al vast, alleen enkele blokken zijn nog verfijnbaar
  - error: uitleg of suggestie niet beschikbaar, maar de handmatige correctie blijft werken
  - success: strategie opgeslagen en terug naar Budget

### Block-level bewerken

- doel: per onderdeel lokaal bijsturen zonder de hoofdflow open te breken
- hoofdsecties:
  - `Inkomsten`
  - `Vaste lasten / abonnementen / reserves`
  - `Budgetverdeling`
  - compacte preview van het effect op het totale voorstel
- primaire CTA: `Bewaar`
- secundaire CTA: `Annuleer`
- states:
  - loading: sheet of detailflow opent met huidig voorstel
  - empty: geen blokgegevens beschikbaar, terug naar voorstel
  - partial: slechts een deel van de blokken is aanpasbaar
  - error: wijziging niet gelukt, herstelactie zichtbaar
  - success: blok opgeslagen en voorstel bijgewerkt

### Review-state na toepassen

- doel: na toepassen direct bevestigen wat ingesteld is, welke user-aanpassingen bestaan en waar nog gefinetuned kan worden
- hoofdsecties:
  - succesheader
  - `Ingesteld door Budio`
  - `Door jou aangepast`
  - `Nog finetunen` met deeplinks naar `Inkomsten`, `Vaste lasten / abonnementen / reserves` en `Budgetverdeling`
  - compacte forecast-disclaimer (verwachting, geen zekerheid)
- primaire CTA: `Terug naar Budget`
- secundaire CTA: `Verder finetunen`

### Strategie-semantiek

- `Standaard`: volgt grotendeels bestaand patroon, met zo weinig mogelijk sturing
- `Balans`: licht corrigeren en waar haalbaar ruimte voor sparen houden
- `Bespaarmodus`: strakke verdeling met prioriteit op veilig blijven en bufferbescherming
- `Handmatig`: gebruiker kiest volledig zelf

### Shell-keuze

- instap, analyse, voorstel en verfijnfase zijn utility/subschermen
- block-level bewerking gebruikt compacte sheets of detailflows, geen nieuwe hoofdscherm-shell
- de Budget-tab blijft zichtbaar als start- en terugkeerpunt, niet als een nieuw primair productmoment

### Stitch-uitwerking (29 maart 2026)

- `Budget tab - voorstel eerst` (`a74406b7485749d089cf9eb18af0c9c4`)
- `Budget beheer - keuze tussen slim en handmatig` (`1c496e99c3b743b1b394c68c18be11e0`)
- `Slim budget instellen - voorsteloverzicht` (`2efd1341088b447e9e7327790a071203`)
- `Slim instellen - onderdelen bewerken` (`d5baa7e078204f2d8a158177713ccade`)
- `Budget toegepast - review` (`df0b05118c3b49faaa58b324a7b6819e`)

## 1e. Admin Design-System Hub Contract

Voor de admin-only design-system hub geldt:

- gebruik `FinanceAdminShell` als basis shell
- bouw de hub als compacte subroute-familie, niet als een nieuw hoofdscherm
- toon de hub als praktische referentie voor tokens, componenten, motion, patronen, bronnen en changelog
- laat Stitch project en canonical asset expliciet terugkomen, zodat de designrichting traceerbaar blijft
- houd de hub rustig, intern en uitlegbaar; geen showcase of nieuwe design language

## 2. Taal en copy

- Alle zichtbare UI-teksten zijn standaard Nederlands.
- Gebruik korte, begrijpelijke termen voor brede doelgroep.
- Geen technische labels in gebruikerscopy.

## 3. Kleuren en surfaces (Budio tokens)

Gebruik alleen deze Budio-kleurrichting:

- achtergrond basis: `#f6f5f2`
- topbar/shell light: `#f7f9fb`
- primaire card: `#ffffff`
- elevated soft: `#efede7`
- input soft: `#f1efea`
- soft cool card: `#f1f4f6`
- tekst primair: `#111111`
- tekst secundair: `#5f5a54`
- tekst muted: `#6f6a63`
- accent geel: `#f2c94c` (spaarzaam en functioneel)
- warning tekst: `#8a6400`
- success: `#2f7d57`
- danger: `#c55d4c`
- border: `#dedad2`
- subtiele border: `rgba(17,17,17,0.08)`
- overlay backdrop: `rgba(17,17,17,0.28)`

Gebruik geen nieuwe kleurtaal buiten deze tokens.

## 4. Typografie

- primair lettertype: Manrope
- ondersteunend label/meta: Inter
- toon: helder, rustig, niet schreeuwerig

Type-richting:

- label/caption compact en ondersteunend
- body goed leesbaar
- titels duidelijk hiërarchisch

## 5. Spacing, radius en elevation

- spacing-schaal op 4px-grid met rustige marges
- radius: 8/12/16/20/24 met pill voor chips, sheet-radius rond 34
- shadows subtiel:
  - top-level card: `0px 6px 12px rgba(17,17,17,0.03)`
  - tinted card: `0px 5px 12px rgba(17,17,17,0.04)`

Geen zware shadowstijl toevoegen.

## 6. Componentrichting

- gebruik bestaande shell-families en componenten als basis
- buttons, cards, list rows, chips, modals en quick actions blijven consistent
- modals/sheets gebruiken één consistente shell-richting
- utility screens blijven eenvoudiger dan hoofdschermen

## 7. Verboden gedrag

- geen redesign-revolutie
- geen nieuwe design language
- geen willekeurige spacing, kleuren, radius of shadows
- geen extra componentpatronen zonder herbruikbaarheid

## 8. Stitch-specifieke beperking

Stitch bepaalt globale richting, maar niet alle app-details 1-op-1.  
Exacte tokencontracten voor alle componentstates, icon sizing en alle elevationvarianten blijven leidend in de codebase.
