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
