# Budio Design System Skill

Gebruik deze skill bij alle design-, UI- en schermtaken in Budio.

## Preview-first workflow

- Preview-first is de standaard werkwijze voor alle toekomstige UI-taken.
- Codex mag NOOIT direct een redesign of nieuwe UI-implementatie uitvoeren.
- Codex moet altijd eerst 2-3 design varianten maken.
- Varianten worden opgeslagen in:
  - `design_refs/proposals/{screen}/{variant}/`
- Elke variant bevat minimaal:
  - een korte uitleg van het concept
  - component structuur, geen volledige code
  - optioneel een lichte JSX preview
- Na het maken van de varianten stopt Codex en wacht op feedback.
- Pas na expliciete keuze van de gebruiker:
  - wordt de gekozen variant verplaatst naar `design_refs/approved/{screen}/`
  - mag implementatie starten

## Standaard Stitch project

- Gebruik voor Budio standaard Stitch-project:
  - `projects/12076228720239525233`
- Titel:
  - `Budio Design System 2026`
- Centrale bron:
  - `docs/design/stitch-project-registry.md`
- Vraag niet opnieuw naar een Stitch project code id als dit standaardproject volstaat.

## Source of truth

- De bestaande codebase is leidend.
- Lees en volg altijd eerst deze design docs:
  - `docs/design/design-system-rules.md`
  - `docs/design/screen-inventory.md`
  - `docs/UI_PATTERNS.md`
  - `docs/design/stitch-project-registry.md`
  - `docs/design/design-foundation.md`
  - `docs/design/design-tokens.md`
  - `docs/design/component-inventory.md`
  - `docs/design/screen-shells.md`
- Als code en documentatie afwijken:
  - analyseer eerst of de code legacygedrag bevat of een bewuste productkeuze is
  - verheft legacy niet stilzwijgend tot nieuwe standaard

## Design principes

- Toon eerst huidige stand, dan ruimte, dan risico of trend, dan advies.
- Toon geen dubbele informatie op hetzelfde niveau.
- Maak klikbaarheid altijd visueel duidelijk.
- Houd de UI rustig, fintech-waardig en begrijpelijk.
- Werk altijd mobile-first.
- Laat shells het ritme bepalen, niet losse scherm-overrides.
- Gebruik bestaande producttaal en introduceer geen nieuwe termen als bestaande termen volstaan.

## Component regels

- Gebruik bestaande componenten eerst.
- Maak geen nieuwe component zonder duidelijke herbruikbaarheid.
- Gebruik bestaande shells eerst:
  - `FinanceDashboardHeader`
  - `FinanceTopBar`
  - `FinanceHeroShell`
  - `FinanceDetailShell`
  - `FinanceUtilityShell`
  - `FinanceBottomSheetShell`
- Gebruik geen nieuwe kleuren buiten tokens uit `constants/theme.ts`.
- Gebruik geen nieuwe shadow-waarden buiten het bestaande elevation- en surface-systeem.
- Gebruik `FinanceButton`, `FinancePressableSurface` en andere gedeelde primitives voordat je losse `TouchableOpacity` of `Pressable`-patronen toevoegt.
- Gebruik geen schermspecifieke hero-, topbar- of modal-varianten als een gedeelde shell al past.

## UX regels

- Utility screens zijn simpel, compact en taakgericht.
- Hoofdschermen mogen visueel sterker zijn, maar blijven rustig en duidelijk.
- Modals en sheets gebruiken consistent gedrag voor backdrop, radius, handle, close, body en footer.
- Quick actions gebruiken een vaste stijl en horen bij de shell, niet bij losse schermdecoratie.
- Empty, loading, partial en error states moeten expliciet en begrijpelijk zijn.

## Verboden gedrag

- Geen redesign zonder eerst analyse van bestaand patroon.
- Geen directe implementatie van redesign, nieuw scherm of nieuwe component zonder previewfase.
- Geen nieuwe design language naast de bestaande Budio-richting.
- Geen willekeurige spacing, kleuren, radius of typografie.
- Geen duplicatie van bestaande UI-patronen.
- Geen nieuwe financiële betekenis in UI-componenten.
- Geen schermspecifieke styling-oplossing als hetzelfde via een gedeelde component of style-module hoort te worden opgelost.

## Werkhouding voor Codex

- Behandel `canoniek` als standaard.
- Behandel `in gebruik` als tijdelijk bestaand patroon dat alleen hergebruikt wordt als er nog geen betere gedeelde standaard is.
- Behandel `legacy` als bestaand gedrag dat niet verder uitgebreid moet worden.
- Start bij UI-werk altijd met proposals, niet met productiecode.
- Benoem expliciet welke bestanden je aanpast, welke risico's er zijn en hoe je handmatig verifieert.
