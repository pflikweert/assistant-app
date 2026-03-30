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
- Canonieke design system asset:
  - `assets/ead01f9cb9454e8da9de7ec3d8ef18e6`
- Canonieke design system naam:
  - `Budio Core Fintech`
- Centrale bron:
  - `docs/design/stitch-project-registry.md`
- Vraag niet opnieuw naar een Stitch project code id als dit standaardproject volstaat.

## Companion skills

Gebruik deze atomic skills als standaard uitbreiding:

- `.codex/skills/budio-enhance-prompt.md`
- `.codex/skills/budio-stitch-loop.md`
- `.codex/skills/budio-design-sync-check.md`
- `.codex/skills/budio-rn-component-mapper.md`
- `.codex/skills/budio-stitch-design-system.md`

## Verplicht sync-rondje na grote designwijziging

Volg altijd:

1. update `docs/design/stitch-design-md.md`
2. verifieer actief design system met:
   - `npm run stitch:tool -- list_design_systems -d '{"projectId":"12076228720239525233"}'`
   - `npm run stitch:tool -- get_project -d '{"name":"projects/12076228720239525233"}'`
3. registreer ids/links in:
   - `docs/design/stitch-project-registry.md`
   - relevante `design_refs/proposals/.../README.md`

## Stitch operatiegids

Gebruik deze commando's als vaste standaard:

- tools tonen:
  - `npm run stitch:tools:list`
- projecten tonen:
  - `npm run stitch:tool -- list_projects`
- screens tonen:
  - `npm run stitch:tool -- list_screens -d '{"projectId":"12076228720239525233"}'`
- nieuwe screen genereren:
  - `npm run stitch:tool -- generate_screen_from_text -d '{"projectId":"12076228720239525233","deviceType":"MOBILE","prompt":"..."}'`
- screen preview ophalen:
  - `npm run stitch:tool -- get_screen_image -d '{"projectId":"12076228720239525233","screenId":"..."}'`
- screen html ophalen:
  - `npm run stitch:tool -- get_screen_code -d '{"projectId":"12076228720239525233","screenId":"..."}'`

Praktische learnings:

- `generate_screen_from_text` kan meerdere minuten duren. Niet opnieuw starten zolang een run nog bezig is.
- `list_screens` kan direct na generatie achterlopen. Eerst opnieuw `list_screens` draaien voordat je concludeert dat de screen ontbreekt.
- Als een variant niet zichtbaar wordt, genereer opnieuw met expliciete prompt:
  - `Create a NEW mobile screen ... with title exactly "...". Do not edit existing screens.`
- Houd varianten apart, zodat A/B/C nooit per ongeluk dezelfde screen overschrijven.

Verplichte registratie na generatie:

- leg per variant vast in `design_refs/proposals/{screen}/{variant}/README.md`:
  - `project` id
  - `screen` id
  - directe `preview` link
- update of controleer ook `docs/design/stitch-project-registry.md` bij projectwijzigingen.

Single design-system guardrail:

- Gebruik bij schermwerk geen `create_design_system`.
- Gebruik bij schermwerk geen nieuwe asset-id.
- Als preflight `get_project` afwijkt van canonieke asset:
  - eerst `apply_design_system` op `assets/ead01f9cb9454e8da9de7ec3d8ef18e6`
  - daarna pas varianten genereren.

## Wat we geleerd hebben

- `asset-stub-assets-...` is een UI-notatie; gebruik in tooling altijd `assets/{id}`.
- Verifieer Stitch-resultaten altijd met zowel `list_design_systems` als `get_project`.
- `update_design_system` kan een sessie bevestigen zonder dat de verkeerde velden echt zijn opgeslagen; controle achteraf is verplicht.
- `apply_design_system` kan nieuwe screen-varianten maken zonder automatisch de project-level design-system instance te wisselen.
- Houd prompts en zichtbare copy standaard Nederlands, anders gaat Stitch snel naar Engelstalige output.

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

## Taal en copy

- Standaard alle zichtbare UI-teksten in het Nederlands.
- Alleen afwijken naar Engels of andere taal als de gebruiker dat expliciet vraagt.
- Ook Stitch prompts, kaarttitels, labels, CTA's en helperteksten zijn standaard Nederlandstalig.
- Vermijd technische of interne termen in zichtbare copy.

## Component regels

- Gebruik bestaande componenten eerst.
- Maak geen nieuwe component zonder duidelijke herbruikbaarheid.
- Maak nieuwe componenten alleen na goedgekeurde Stitch-designreview.
- Gebruik Engelse componentnamen met duidelijke intentie.
- Plaats componenten in logische mappen (`components/{domain}` of `components/ui`).
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
- Voor Stitch design-system beheer: gebruik ook `.codex/skills/budio-stitch-design-system.md`.
