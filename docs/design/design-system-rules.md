# Design System Rules

Dit document is de compacte ontwerp- en werkafspraak voor alle UI-wijzigingen in Budio. Gebruik deze regels samen met `AGENTS.md`, `docs/design/screen-inventory.md` en `docs/UI_PATTERNS.md`.

## Reading Order

1. Lees `AGENTS.md`
2. Lees dit document
3. Lees `docs/design/screen-inventory.md`
4. Lees `docs/UI_PATTERNS.md`
5. Voor Stitch/Codex designwerk: lees `docs/design/stitch-codex-workflow.md`
6. Controleer daarna de relevante schermen en componenten in de codebase

## Doel

- Houd designwerk deterministisch, herhaalbaar en klein
- Voorkom losse schermspecifieke stijlvarianten als een gedeeld patroon beter past
- Bescherm bestaande businesslogica, routing en services tegen onbedoelde UI-heruitvinding

## Niet Onderhandelbaar

- Behoud bestaande businesslogica, services en routing
- Gebruik bestaande tokens, helpers en componenten waar mogelijk
- Voeg geen nieuwe dependencies toe zonder noodzaak
- Maak loading, empty, partial en error states expliciet
- Maak geen desktop-web-first layout als het scherm mobiel bedoeld is
- Bouw geen nieuwe financiële betekenis in componenten; UI presenteert alleen wat services al bepalen
- Voeg geen nieuwe ruwe hex-kleuren toe in `app/` of `components/` buiten expliciete allowlist-paden
- Voeg geen nieuwe directe typografie-/spacing-literals toe buiten expliciete allowlist-paden; gebruik `FinanceText` en `FinTokens.spacing`
- Voeg geen nieuwe ruwe `TouchableOpacity`/`Pressable`-patronen toe op productsurfaces; gebruik `FinanceButton` of `FinancePressableSurface`

## Design Token Contract

- Kleurgebruik in product-UI komt uit `FinTokens.color` in `constants/theme.ts`
- Spacing komt uit `FinTokens.spacing` (4px-grid-afgeleid)
- Radius komt uit `FinTokens.radius`
- Typografie komt uit `FinTokens.typography`:
  - `caption`, `body-sm`, `body`, `body-lg`, `title-sm`, `title`, `h3`, `h2`, `h1`
- Gebruik `FinanceText` voor nieuwe producttekst i.p.v. losse `fontSize`/`lineHeight` literals
- Nieuwe schermen en componenten gebruiken tokens, geen losse kleur- of spacingwaarden
- Als er geen veilige tokenmatch bestaat: markeer met `// TODO: DESIGN-DEBT` en los het bewust op in een vervolg-PR (niet gokken)
- Budgetprogress gebruikt de vaste kleurset uit `FinTokens.color`:
  - `budgetProgressTrack`, `budgetProgressGood`, `budgetProgressWatch`, `budgetProgressCritical`, `budgetProgressNeutral`
- Grote gekleurde kaarten op hoofdschermen gebruiken `FinTokens.color.surfaceSoftCool` en de gedeelde `FinSurfaces.mainPageTintedCard` (lichte schaduw verplicht)
- Hoofdscherm-spacing komt uit `components/ui/main-page-spacing.ts` en wordt bewaakt door `services/main-page-spacing.test.ts`

## A11y Contrast Contract

- `textPrimary` op `surface` en `surfaceSoft` moet minimaal AA contrast halen
- `textSecondary` op `surface` en `surfaceSoft` moet minimaal AA contrast halen
- `textMuted` is alleen toegestaan op:
  - `surface` en `surfaceSoft` voor secundaire context
  - nooit voor primaire bedragen, CTA's of kritieke statusmeldingen
- Bij twijfel: verhoog contrast of promote label naar `textSecondary`

## Shell-Regels

- Elk scherm is vooraf óf `hoofdscherm` óf `utility/subscherm`
- Hoofdschermen gebruiken de gedeelde app-shell
- Utility/subschermen gebruiken compacte detail-, modal- of sheet-shells
- Combineer shells niet in één scherm
- Als een scherm twijfelachtig voelt, analyseer eerst navigatie, gebruikersdoel en bestaand patroon

## Component-First Regels

- Als een patroon op meer dan één scherm kan terugkomen, bouw eerst een gedeelde component of stijlmodule
- Houd schermen dun: schermen leveren inhoud en uitzonderingen, componenten dragen layout en shellgedrag
- Ruim tijdelijke inline varianten op zodra de gedeelde component bestaat
- Laat terugkerende shell-elementen nooit lokaal per scherm opnieuw ontstaan
- Hergebruik bestaande componenten eerst, pas daarna een nieuwe variant maken als er echt geen passend patroon is

## Pattern Map (Canoniek)

- Dashboard/Home (cockpit-head):
  - `FinanceDashboardHeader` + primaire cockpit-head met dominante hoofdstat + gecentreerde contentkolom
- Hoofdscherm:
  - `FinanceTopBar` + `FinanceHeroShell` + gecentreerde contentkolom
- Utility/detail:
  - `FinanceDetailShell` als standaard detailwrapper
  - `FinanceDetailTopBar` alleen voor uitzonderingen binnen bestaande shells
- Modal/sheet/selectorflow:
  - `FinanceBottomSheetShell`
- Backdrop:
  - `FinanceScreenBackdrop` als gedeelde achtergrondlaag

## Componentcatalogus (Core Set)

- Shell: `FinanceTopBar`, `FinanceDashboardHeader`, `FinanceDetailShell`, `FinanceDetailTopBar`, `FinanceHeroShell`, `FinanceBottomSheetShell`, `FinanceScreenBackdrop`, `FinanceUtilityShell`, `FinanceAdminShell`
- Structuurblokken: `FinanceSectionHeader`, `FinanceDetailCard`, `FinanceTextBlock`
- Atomics: `FinanceText`, `FinanceButton`
- Interactie-oppervlak: `FinancePressableSurface`
- Status/signaal: `FinanceInlineCallout`, `FinanceStatusChip`
- Selectie: `FinanceMonthSelector`, `FinanceScopeSwitch`, `FinanceMonthSelectorModal`
- Empty/loading:
  - gebruik bestaande patrooncomponenten of routeconforme card-variant uit `UI_PATTERNS.md`

## Mobiel-Eerst Regels

- Ontwerp eerst voor verticale flow en kleine schermen
- Houd content binnen de bestaande gecentreerde contentkolom
- Gebruik full-bleed alleen voor hero- of sectieankers die daar aantoonbaar baat bij hebben
- Bewaak spacing, touch targets en leesbaarheid op mobiele breedtes

## State-Regels

- Elke nieuwe of aangepaste flow moet expliciet een loading-, empty-, partial- en error-state hebben
- Empty states moeten uitleggen wat ontbreekt en wat de gebruiker nu kan doen
- Partial states moeten duidelijk maken wat al bekend is en wat nog niet
- Error states moeten compact, vriendelijk en herstelgericht blijven

## Designwijzigingen

- Update `docs/design/screen-inventory.md` als een route, taak of state verandert
- Update `docs/UI_PATTERNS.md` als een nieuw gedeeld visueel patroon ontstaat
- Voeg alleen een nieuw shared component toe als hergebruik op meerdere plekken logisch is
- Bewaak dat designwerk de huidige producttaal niet verwatert met nieuwe termen

## Do-Not-Vary Baseline

- Topbar shellhoogte en verticale ritmiek binnen dezelfde schermfamilie
- Hero offset binnen dezelfde shellfamilie
- Content max-width voor hoofd- en utilityschermen
- Sheet radius en close/backdrop gedrag
- Card basisradius per componentvariant
- Spacing schaal (via `FinTokens.spacing`):
  - `none`, `xxs`, `xs`, `xs-plus`, `s`, `s-plus`, `m`, `m-plus`, `l`, `l-plus`, `xl`, `2xl`, `3xl`, `4xl`

## Outputverwachting Voor Designtaken

Bij elk designwerk moet de output kort en concreet zijn:

1. welke bestanden zijn aangepast
2. welke risico's of regressies er zijn
3. hoe het handmatig getest moet worden

## Praktische Check

- Als iets slechts één scherm helpt, hergebruik bestaande shell- en componentpatronen
- Als iets op meerdere schermen relevant kan zijn, centraliseer het direct
- Als iets routing, dataflow of financiële semantiek raakt, wijzig dan eerst de service of selector en laat UI alleen renderen
