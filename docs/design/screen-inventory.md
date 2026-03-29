# Screen Inventory

Deze inventaris is de route-gedreven bron van waarheid voor UI-werk. Voeg een route hier eerst toe als je er designwerk aan wilt doen.

## Master URL-Map (Hiërarchisch doelmodel)

Deze map is de **doelstructuur** voor consolidatie. Huidige routes blijven tijdelijk bestaan via compat-mapping totdat migratie klaar is.

| domein | parent route | doel-subroutes | huidige route(s) die hier naartoe migreren |
| --- | --- | --- | --- |
| Dashboard/Home | `/` | n.v.t. | `/` |
| Transactions | `/transactions` | `/transactions/:id`, `/transactions/:id/edit`, `/transactions/import`, `/transactions/import/review` | `/transactions`, `/transaction-detail`, `/csv-import`, `/import-control`, `/import-afronden` |
| Budget | `/budget` | `/budget/setup`, `/budget/setup/proposal`, `/budget/setup/review`, `/budget/categories`, `/budget/categories/groups` | `/budget`, `/budget/setup`, `/category-budget-groups` |
| Insights | `/insights` | `/insights/:analysisId`, `/insights/upcoming` | `/insights`, `/analysis-detail`, `/insights-legacy` |
| Accounts | `/accounts` | `/accounts`, `/accounts/link`, `/accounts/:id/edit` | `/bankrekeningen`, `/rekeningen-koppelen` |
| Subscriptions | `/subscriptions` | `/subscriptions`, `/subscriptions/:id` | `/subscriptions` |
| Settings | `/settings` | `/settings/profile`, `/settings/security/password`, `/settings/data`, `/settings/forecast` | `/settings`, `/settings/security/password`, `/account/change-password` |
| Admin | `/admin` | `/admin/design-system`, `/admin/design-system/tokens`, `/admin/design-system/components`, `/admin/design-system/motion`, `/admin/design-system/patterns`, `/admin/design-system/sources`, `/admin/design-system/changelog`, `/admin/ai-review`, `/admin/ai-usage`, `/admin/ai-routes` | `/admin` |
| Auth | `/auth` | `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | `/auth/*`, `/login` |

## Canonical Shell Mapping

| route | shell | screen family | opmerking |
| --- | --- | --- | --- |
| `/` | `FinanceHeroShell` (via `FinanceDashboardHeader` cockpit-home variant) | Dashboard | Canoniek cockpit-home met primaire hoofdstat; geen generieke dashboardgrid. |
| `/transactions` | `FinanceHeroShell` | Dashboard | Hoofdtab met hero-context. |
| `/transactions/[id]` | `FinanceDetailShell` | Detail | Compatibele detailroute naast `/transaction-detail` tijdens migratie. |
| `/budget` | `FinanceHeroShell` | Dashboard | Hoofdtab met budget-overzicht. |
| `/budget/setup` | `FinanceUtilityShell` | Utility/Setup | Begeleide budget-instelflow met voorstel en verfijning. |
| `/budget/setup/proposal` | `FinanceUtilityShell` | Utility/Setup | Multi-page wizard: voorsteloverzicht en toepassen. |
| `/budget/setup/review` | `FinanceUtilityShell` | Utility/Setup | Multi-page wizard: review-state na toepassen. |
| `/insights` | `FinanceHeroShell` | Dashboard | Hoofdtab met forecast/trends. |
| `/transaction-detail` | `FinanceDetailShell` | Detail | Altijd terug naar `/transactions`. |
| `/analysis-detail` | `FinanceDetailShell` | Detail | Altijd terug naar `/insights`. |
| `/bankrekeningen` | `FinanceUtilityShell` | Utility | Overzicht + beheerflow. |
| `/accounts/link` | `FinanceSheetShell` | Utility/Sheet | Importkoppeling als snelle actieflow. |
| `/rekeningen-koppelen` | `FinanceSheetShell` | Legacy redirect | Compatibele redirect naar `/accounts/link`. |
| `/subscriptions` | `FinanceUtilityShell` | Utility | Beheerflow met cards/lijst. |
| `/category-budget-groups` | `FinanceDetailShell` | Detail | Beheer binnen budgetdomein. |
| `/csv-import` | `FinanceSheetShell` | Utility/Sheet | Start importactie. |
| `/import-control` | `FinanceSheetShell` | Utility/Sheet | Tussenstap met voortgang. |
| `/import-afronden` | `FinanceDetailShell` | Utility | Afronding met CTA terug naar parent. |
| `/settings` | `FinanceUtilityShell` | Utility | Groepen + settings rows. |
| `/settings/security/password` | `FinanceUtilityShell` | Utility | Security subflow van settings. |
| `/account/change-password` | `FinanceUtilityShell` | Legacy redirect | Compatibele redirect naar `/settings/security/password`. |
| `/modal` | `FinanceSheetShell` | Utility/Sheet | Voorbeeldroute. |
| `/admin` | `FinanceAdminShell` | Admin | Dense databeheer, admin-only. |
| `/auth/login` | `FinanceUtilityShell` | Utility/Auth | Compacte auth-shell. |
| `/auth/register` | `FinanceUtilityShell` | Utility/Auth | Compacte auth-shell. |
| `/auth/forgot-password` | `FinanceUtilityShell` | Utility/Auth | Compacte auth-shell. |
| `/auth/reset-password` | `FinanceUtilityShell` | Utility/Auth | Compacte auth-shell. |
| `/auth/new-password` | `FinanceUtilityShell` | Utility/Auth | Alias naar resetflow. |
| `/login` | `FinanceUtilityShell` | Legacy redirect | Redirect-only naar `/auth/login`. |
| `/insights-legacy` | `FinanceDetailShell` | Legacy | Geen primary route meer. |

## Richtlijnen

- `status`: `active`, `utility`, `legacy`, `admin`, `example`
- `loading`, `empty`, `partial`, `error` moeten per route expliciet blijven
- Structural files zoals `_layout.tsx` en `+html.tsx` staan hier niet in, tenzij ze zich als user-facing scherm gedragen

## Main Tabs

| route | status | doel | primaire gebruikers-taak | wat absoluut moet blijven | welke data het scherm gebruikt | states |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | active | Primair beslisscherm van de app: de dagelijkse financiële cockpit. | In een paar seconden zien hoeveel veilig is tot volgende inkomen, wat nu vrij is, welk risico dichtbij is en wat nu de beste actie is. | `Veilig tot volgende inkomen` als dominant hoofdsignaal, `Nu vrij` als secundaire context, compact `Reserves & buffer`, maximaal 1 dominante risicokaart en exact 1 dominante actiekaart; geen generiek overzichtsscherm. | latest-known balance, money view scope, safety-spend-window, forecast summary, budget plan, reserve surface, risk selectors, explainability, rekeningen, abonnementen alleen als conditionele risico- of actie-input | loading: cockpit-head en decision-block skeletons; empty: shell blijft zichtbaar zonder data; partial: brondata of forecast mist maar Home geeft nog steeds een veilig hoofdantwoord; error: retry + fallback cards |
| `/transactions` | active | Transactieoverzicht en snelle correctie. | Zoeken, filteren en transacties openen of bijsturen. | Scanbare lijst, maand/filtercontext, detailnavigatie en snelle correctie-acties. | transacties, filters, categorieën, bankrekeningfilters, abonnementskoppelingen | loading: lijst skeleton; empty: geen transacties in de gekozen periode; partial: filters/data incompleet; error: retry + foutmelding |
| `/insights` | active | Trends, forecast, risico en uitleg. | Begrijpen wat er komende weken en maanden gebeurt. | Maandcontext, forecastalignement, `Wat valt op`, `Komende momenten`, rustige scroll-opbouw. | budget plan, forecast summary, latest-known balance, reserve surface, timeline events, categorieën, scope preference, maandopties, rekeningen, abonnementen | loading: insights skeleton; empty: geen bruikbare data maar duidelijke fallback; partial: forecast of timeline deels beschikbaar; error: retry + fallback cards |
| `/budget` | active | Maand- en weeksturing plus budgetbeheer. | Zien waar ruimte zit en budgetinstellingen aanpassen. | Scheiding tussen dag/week/maand, beheersegment, budgetrekenregels, overzichtelijke voortgang en toegang tot een voorstel-eerst budgetflow met `Slim met Budio` (primair) en `Handmatig` (secundair). | budget plan, budgetsettings, reserve rules, maandopties, categorieën, rekeningen, transacties, scope preference | loading: budget skeleton; empty: nog geen budgetplan; partial: settings of forecast deels beschikbaar; error: retry + fallback summary |
| `/settings` | utility | Beheer, onderhoud en technische huishoudtaken. | Forecast resetten, categorisatie beheren en schoonmaakacties uitvoeren. | Toegang tot onderhoudsacties zonder de app te overweldigen. | sessie, categorisatie-status, forecast refresh-status, cleanup-resultaten, quick menu, admin access | loading: statuskaarten en spinners; empty: acties blijven zichtbaar met uitleg; partial: enkele tools niet beschikbaar; error: duidelijke herstelactie/retry |

## Utility en Detail

Opmerking migratiestatus:
- `/budget/setup` is canoniek opgenomen en fysiek aanwezig als utilityroute (`app/budget/setup.tsx`).

| route | status | doel | primaire gebruikers-taak | wat absoluut moet blijven | welke data het scherm gebruikt | states |
| --- | --- | --- | --- | --- | --- | --- |
| `/bankrekeningen` | utility | Overzicht en beheer van bankrekeningen. | Rekeningen bekijken, toevoegen, bewerken en verwijderen. | Rustig overzicht, create/edit sheet, delete-flow en korte samenvatting per rekening. | bankrekeningen, transactieaantallen, forecast dirty mark, accountmetadata | loading: lijst skeleton; empty: geen rekeningen; partial: metadata of telling mist; error: retry + foutmelding |
| `/budget/setup` | utility | Begeleide budget-instelflow. | Een slim voorstel laten maken, bevestigen of verfijnen en lokaal per blok bijsturen. | `Start` (met `Slim met Budio` primair en `Handmatig` secundair), `Analyse`, `Voorstel`, `Verfijnen`, `Onderdelen bewerken` en `Review na toepassen` blijven binnen dezelfde flow; AI start niet als chat-first entry. | budget plan, budget coach, budget settings, reserve rules, income preview, forecast summary | loading: analyse/progress; empty: nog geen voorstel of onvoldoende brondata; partial: voorstel met beperkte brondata; error: herstelactie of terug naar Budget; success: voorstel toegepast en review-state met finetune-routes |
| `/budget/setup/proposal` | utility | Voorsteloverzicht binnen de slimme setup wizard. | Strategie kiezen, voorstel zien, bijsturen en toepassen. | Variabele verdeling, strategiekeuze, componentniveau-bewerking en apply-flow blijven compact en voorstelgestuurd. | budget setup orchestrator, budget plan context, apply service, reserve/income drafts | loading: voorstel wordt opgebouwd; empty: te weinig data; partial: lage confidence; error: retry; success: route naar review |
| `/budget/setup/review` | utility | Review-state na toepassen. | Snel zien wat is ingesteld en waar nog gefinetuned kan worden. | Duidelijke succesbevestiging, ingesteld-overzicht en deeplinks terug naar voorstelbewerking. | apply-result summary, geselecteerde maand/mode, budget route context | loading: n.v.t.; empty: ontbreken applycontext -> terug naar proposal; partial: beperkte samenvatting; error: terugval naar proposal |
| `/accounts/link` | utility | Importgroepen koppelen aan bestaande rekeningen. | Een bronrekening kiezen of een nieuwe maken voor een importgroep. | Auto-match, gekoppelde status, create-new optie en veilige sheet-flow. | import draft, bankrekeningen, import flow state, gekoppelde groepen | loading: bankrekeningen laden; empty: geen rekeningen beschikbaar; partial: enkele groepen al gekoppeld; error: retry + veilige terugval |
| `/subscriptions` | utility | Abonnementen beheren en koppelen. | Profielen, regels en gekoppelde transacties controleren. | Regel- en profielbeheer, duidelijke matchingstatus en gekoppelde betalingen. | subscription profiles, rules, queue items, validation candidates, transactions | loading: dashboard laden; empty: geen abonnementen gevonden; partial: regels of candidates missen; error: retry + foutmelding |
| `/transaction-detail` | utility | Eén transactie detail en correctie. | Categorie, abonnement en budgetstatus bijwerken. | Context eerst, snelle correctie en duidelijke AI/handmatig-keuze. | transactie-detail, categorieën, historie, subscription match, rule match, zoekresultaten | loading: detail skeleton; empty: transactie niet gevonden; partial: categorie of koppelingen missen; error: retry + herstelroute |
| `/transactions/[id]` | utility | Compatibele routevariant voor transactie-detail. | Zelfde taak als `/transaction-detail` met route-compatibiliteit. | Zelfde detailgedrag behouden totdat URL-consolidatie afgerond is. | transactie-detail, categorieën, historie, subscription match, rule match, zoekresultaten | loading/empty/partial/error: identiek aan `/transaction-detail` |
| `/analysis-detail` | utility | Detailanalyse van een uitgavenpatroon. | Vergelijken, verklaren en categoriseren van een analysecluster. | Maandvergelijking, subgroup-opbouw en scanbare statistiek. | transacties, categorieën, subscription names, maandtrends, descriptoren | loading: analyse laden; empty: geen cluster gevonden; partial: minder maanddata beschikbaar; error: retry + fallback explanation |
| `/category-budget-groups` | utility | Budgetgroep-indeling van categorieën beheren. | Categorieën herindelen en overrides beheren. | Overzicht van beheerbare categorieën, overrides en forecast dirty trigger. | categorieën, overrides, forecast refresh status | loading: categorieën/overrides laden; empty: geen beheerbare categorieën; partial: sommige overrides ontbreken; error: retry + foutmelding |
| `/csv-import` | utility | Startpunt voor CSV-import. | Bestand kiezen en import starten. | Heldere startflow, veilige upload en importcontext. | import flow state, bestandspicker, draft-opbouw | loading: opstart/initialisatie; empty: nog geen bestand gekozen; partial: draft voorbereid maar niet gestart; error: import foutmelding + opnieuw proberen |
| `/import-control` | utility | Tussenstap tijdens importverwerking. | Voortgang volgen en wachten tot het opslaan klaar is. | Progress, step-indicator en veilige blokkering van navigatie tijdens schrijven. | import draft, run state, runner progress | loading: control/status running; empty: geen draft -> redirect; partial: voorbereiding of schrijven bezig; error: onderbroken run met retry |
| `/import-afronden` | utility | Afronding na import. | Samenvatting bekijken en naar transacties gaan. | Resultatenoverzicht, categorisatiecontext en duidelijke vervolgstap. | import result, draft, step state | loading: n.v.t. behalve redirect; empty: geen result -> redirect; partial: categorisatie nog in queue; error: mislukte afronding met herstelpad |
| `/settings/security/password` | utility | Wachtwoord wijzigen vanuit accountinstellingen. | Veilig een nieuw wachtwoord instellen. | Koppeling met huidige sessie en eenvoudige terugweg naar settings. | huidige sessie, user, updatePassword flow | loading: wachtwoordactie bezig; empty: formulieren leeg; partial: gedeeltelijk ingevuld; error: validatie of updatefout |
| `/modal` | example | Voorbeeldroute voor een modalachtige shell. | Modalgedrag en shell tonen. | Shell- en kaartpatroon, niet de inhoud. | geen app-data nodig | loading: statische shell; empty: demo-inhoud blijft zichtbaar; partial: n.v.t.; error: n.v.t. |

## Auth

| route | status | doel | primaire gebruikers-taak | wat absoluut moet blijven | welke data het scherm gebruikt | states |
| --- | --- | --- | --- | --- | --- | --- |
| `/auth/login` | active | Inloggen in de app. | Veilig aanmelden met e-mail en wachtwoord. | AuthShell, reset-link, duidelijke foutmelding. | sessie, login mutatie, auth error messages | loading: submit spinner; empty: formulier leeg; partial: alleen e-mail of wachtwoord ingevuld; error: authfout zichtbaar |
| `/auth/register` | active | Nieuw account aanmaken. | Registreren met naam, e-mail en wachtwoord. | Validatie, succesmelding en redirect-logica. | session register flow, e-mail redirect, password feedback | loading: submit spinner; empty: formulier leeg; partial: velden deels valide; error: validatie of registratiefout |
| `/auth/forgot-password` | active | Resetlink aanvragen. | E-mailadres invullen en reset starten. | Duidelijke resetcopy en veilige bevestiging. | password reset request, e-mailvalidatie | loading: submit spinner; empty: e-mail leeg; partial: e-mail onvolledig; error: resetfout zichtbaar |
| `/auth/reset-password` | active | Nieuw wachtwoord instellen via resetlink. | Recovery-link valideren en wachtwoord vernieuwen. | Recovery-check, duidelijke fout-/succesflow en redirect. | session recovery token, password update, auth state events | loading: sessie controleren; empty: n.v.t.; partial: wachtwoord deels ingevuld; error: invalid token of updatefout |
| `/auth/new-password` | active | Alias naar reset-password flow. | Zelfde recovery-/resettaak als reset-password. | Geen apart gedrag; moet dezelfde recoveryflow blijven volgen. | dezelfde data als `/auth/reset-password` | loading/empty/partial/error: identiek aan reset-password |

## Legacy, Redirects en Admin

| route | status | doel | primaire gebruikers-taak | wat absoluut moet blijven | welke data het scherm gebruikt | states |
| --- | --- | --- | --- | --- | --- | --- |
| `/insights-legacy` | legacy | Oud insights-scherm als fallback/vergelijking. | Alleen gebruiken als oudere route nog nodig is. | Legacy forecast/trendlogica mag de primaire insights niet meer overschrijven. | oudere forecast, budget plan, rare subscriptions, transacties, categorieën | loading: oude shell; empty: fallback cards; partial: enkele legacybronnen ontbreken; error: safe fallback |
| `/login` | legacy | Redirect naar de nieuwe auth login. | Geen eigen taak; alleen doorgestuurde route. | Moet blijven redirecten naar `/auth/login`. | geen inhoudelijke data | loading/empty/partial/error: redirect only |
| `/account/change-password` | legacy | Redirect naar de nieuwe security-route in settings. | Geen eigen taak; alleen doorgestuurde route. | Moet blijven redirecten naar `/settings/security/password`. | geen inhoudelijke data | loading/empty/partial/error: redirect only |
| `/rekeningen-koppelen` | legacy | Redirect naar de nieuwe accounts-link route. | Geen eigen taak; alleen doorgestuurde route. | Moet blijven redirecten naar `/accounts/link`. | geen inhoudelijke data | loading/empty/partial/error: redirect only |
| `/admin` | admin | AI- en reviewbeheer voor admingebruik. | Route settings, review items en usage controleren. | Duidelijk admin-only gedrag, review-tafels en veilige edits. | admin bootstrap, route settings, usage overview, review inbox | loading: bootstrap laden; empty: geen review-items of usage; partial: enkele blokken missen; error: retry + adminfout |
| `/admin/design-system` | admin | Interne design-system hub voor overzicht en governance. | Snel het huidige Budio Design System bekijken en gebruiken. | Admin-only toegang, Stitch project en canonical asset zichtbaar, praktische referentie i.p.v. showcase. | design-system hub data uit codebase en docs, Stitch registry, changelog | loading: admin check; empty: nog geen changelog of bronupdate; partial: sommige doc-bronnen of componentgroepen ontbreken; error: retry + terug naar settings |
| `/admin/design-system/tokens` | admin | Tokenreferentie voor kleuren, typografie, spacing, radius, borders en shadows. | Direct een tokenwaarde of gebruikscontext vinden. | Toon alleen live of herleidbare tokens; markeer niet-uniforme contracten zichtbaar. | `constants/theme.ts`, token-inventaris, design docs | loading: admin check; empty: geen tokens geladen; partial: fonts of shadows deels docs-backed; error: retry + terug naar overzicht |
| `/admin/design-system/components` | admin | Componentcatalogus met live previews en inventaris. | Snel een bestaande UI-bouwsteen terugvinden en toepassen. | Echte componentfamilies, mock data alleen voor previews, geen fake catalogus. | gedeelde UI-componenten, voorbeelddata, component-inventaris | loading: admin check; empty: previewdata ontbreekt; partial: sommige componentfamilies nog patroonmatig; error: retry + terug naar overzicht |
| `/admin/design-system/motion` | admin | Motioncatalogus met live previews van motioncomponenten en hooks. | Motionpatronen terugvinden en consistent toepassen zonder overanimatie. | Gebruik bestaande motioncomponenten/hook-contracten, respecteer reduce-motion, geen decoratieve overload. | `components/motions/*`, motion-families, pattern-richtlijnen | loading: admin check; empty: geen motionitems gevonden; partial: hooks wel maar demo's beperkt; error: retry + terug naar overzicht |
| `/admin/design-system/patterns` | admin | Opbouwregels voor shells, utility-gedrag en modalflows. | Bepalen welk shell- en opbouwpatroon past. | Gebruik dit voor beslisregels, niet voor visuele showcase. | UI-pattern docs, screen-shells, admin shell families | loading: admin check; empty: geen patternblocks geladen; partial: enkele docverwijzingen ontbreken; error: retry + terug naar overzicht |
| `/admin/design-system/sources` | admin | Bronnen-, sync- en onderhoudspaneel. | Leidende files, Stitch-referentie en onderhoudsflow controleren. | Bron van waarheid blijft codebase + docs; hub is referentie, geen waarheid zelf. | lead files, Stitch registry, canonical asset, sync commands | loading: admin check; empty: geen synccontext beschikbaar; partial: enkele doc-bronnen ontbreken; error: retry + terug naar overzicht |
| `/admin/design-system/changelog` | admin | Compact intern wijzigingslog. | Recente design-systemwijzigingen terugvinden. | Kort, onderhoudbaar en bronverwijzend; geen auditlog. | changelog entries, design-system update notes | loading: admin check; empty: nog geen entries; partial: changelog placeholder of lege lijst; error: retry + terug naar overzicht |

## Uitgesloten

- `app/_layout.tsx`
- `app/(tabs)/_layout.tsx`
- `app/auth/_layout.tsx`
- `app/+html.tsx`

Deze zijn shell- of infrastructuurlaag en geen losse scherminventaris-entries.
