import { FinSurfaces, FinTokens, Fonts } from "@/constants/theme";

export type DesignSystemHubSectionId =
  | "overview"
  | "tokens"
  | "components"
  | "motion"
  | "patterns"
  | "sources"
  | "changelog";

export type DesignSystemHubSection = {
  id: DesignSystemHubSectionId;
  label: string;
  href: string;
  description: string;
};

export type DesignSystemHubTokenGroup = {
  title: string;
  subtitle: string;
  items: {
    key: string;
    value: string | number;
    usage: string;
  }[];
};

export type DesignSystemHubComponentFamily = {
  title: string;
  status: "canoniek" | "in gebruik" | "legacy";
  source: string;
  usedIn: string;
  note: string;
  items: string[];
};

export type DesignSystemHubMotionFamily = {
  title: string;
  status: "canoniek" | "in gebruik" | "legacy";
  source: string;
  usedIn: string;
  note: string;
  items: string[];
};

export type DesignSystemHubPatternBlock = {
  title: string;
  useWhen: string;
  avoidWhen: string;
  sources: string[];
};

export type DesignSystemHubSourceItem = {
  label: string;
  detail: string;
};

export type DesignSystemHubChangelogEntry = {
  date: string;
  title: string;
  summary: string;
};

export type DesignSystemHubFlowCoverage = {
  area: string;
  routes: string[];
  shell: string;
  componentFocus: string[];
  tokenFocus: string[];
  patternFocus: string[];
  sourceFocus: string[];
  dataMode: "live" | "mixed";
  attention: string;
};

export const designSystemHubSections: DesignSystemHubSection[] = [
  {
    id: "overview",
    label: "Overzicht",
    href: "/admin/design-system",
    description: "Wat deze hub is en welke bronnen leidend zijn.",
  },
  {
    id: "tokens",
    label: "Tokens",
    href: "/admin/design-system/tokens",
    description: "Live tokenwaarden uit code en docs.",
  },
  {
    id: "components",
    label: "Componenten",
    href: "/admin/design-system/components",
    description: "Bestaande UI-bouwstenen met usage-notes.",
  },
  {
    id: "motion",
    label: "Motion",
    href: "/admin/design-system/motion",
    description: "Motioncomponenten en hooks met gebruiksregels.",
  },
  {
    id: "patterns",
    label: "Patronen",
    href: "/admin/design-system/patterns",
    description: "Shell-, layout- en gebruiksregels.",
  },
  {
    id: "sources",
    label: "Bronnen & sync",
    href: "/admin/design-system/sources",
    description: "Leidende bestanden en onderhoudsflow.",
  },
  {
    id: "changelog",
    label: "Wijzigingen",
    href: "/admin/design-system/changelog",
    description: "Compact intern wijzigingslog.",
  },
];

export const designSystemHubMeta = {
  stitchProjectName: "Budio Design System 2026",
  stitchProjectId: "projects/12076228720239525233",
  canonicalAssetId: "assets/ead01f9cb9454e8da9de7ec3d8ef18e6",
  canonicalAssetDisplayName: "Budio Core Fintech",
  canonicalAssetVersion: "2",
  sourceOfTruth: "Codebase + repo-docs",
  runtimeSurface: "constants/theme.ts",
};

const WEB_SANS_FALLBACK =
  "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const WEB_MONO_FALLBACK =
  "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

export type DesignSystemHubColorToken = {
  key: keyof typeof FinTokens.color;
  value: string;
  usage: string;
};

export const designSystemHubColorTokens: DesignSystemHubColorToken[] = [
  { key: "bgBase", value: FinTokens.color.bgBase, usage: "App-basisachtergrond" },
  { key: "topBarBg", value: FinTokens.color.topBarBg, usage: "Topbars en shells" },
  { key: "bgCard", value: FinTokens.color.bgCard, usage: "Primaire kaarten" },
  { key: "bgElevated", value: FinTokens.color.bgElevated, usage: "Zachte elevated oppervlakken" },
  { key: "bgInput", value: FinTokens.color.bgInput, usage: "Inputs en subtiele keuzes" },
  { key: "bgCardSoftCool", value: FinTokens.color.bgCardSoftCool, usage: "Koele hoofdkaart" },
  { key: "textPrimary", value: FinTokens.color.textPrimary, usage: "Hoofdtekst en bedragen" },
  { key: "textSecondary", value: FinTokens.color.textSecondary, usage: "Secundaire uitleg" },
  { key: "textMuted", value: FinTokens.color.textMuted, usage: "Ondersteunende metadata" },
  { key: "yellow", value: FinTokens.color.yellow, usage: "Functioneel accent" },
  { key: "yellowSoft", value: FinTokens.color.yellowSoft, usage: "Zachte accentachtergrond" },
  { key: "warningText", value: FinTokens.color.warningText, usage: "Waarschuwingstekst" },
  { key: "green", value: FinTokens.color.green, usage: "Succes en positief signaal" },
  { key: "red", value: FinTokens.color.red, usage: "Fout en kritisch signaal" },
  { key: "border", value: FinTokens.color.border, usage: "Zichtbare scheiding" },
  { key: "borderSubtle", value: FinTokens.color.borderSubtle, usage: "Rustige scheiding" },
  { key: "overlayBackdrop", value: FinTokens.color.overlayBackdrop, usage: "Backdrops en overlays" },
  { key: "warningBg", value: FinTokens.color.warningBg, usage: "Waarschuwingsvlak" },
  { key: "redBg", value: FinTokens.color.redBg, usage: "Kritieke achtergrond" },
  { key: "greenBg", value: FinTokens.color.greenBg, usage: "Positieve achtergrond" },
  { key: "statusGoodBg", value: FinTokens.color.statusGoodBg, usage: "Statuschip positief" },
  { key: "statusGoodText", value: FinTokens.color.statusGoodText, usage: "Statuschip tekst" },
  { key: "budgetProgressTrack", value: FinTokens.color.budgetProgressTrack, usage: "Budgetprogress track" },
  { key: "budgetProgressGood", value: FinTokens.color.budgetProgressGood, usage: "Budgetprogress goed" },
  { key: "budgetProgressWatch", value: FinTokens.color.budgetProgressWatch, usage: "Budgetprogress let op" },
  { key: "budgetProgressCritical", value: FinTokens.color.budgetProgressCritical, usage: "Budgetprogress kritisch" },
  { key: "budgetProgressNeutral", value: FinTokens.color.budgetProgressNeutral, usage: "Budgetprogress neutraal" },
  { key: "switchTrackOff", value: FinTokens.color.switchTrackOff, usage: "Uitstand switch" },
  { key: "switchTrackOn", value: FinTokens.color.switchTrackOn, usage: "Aanstand switch" },
  { key: "switchThumbOff", value: FinTokens.color.switchThumbOff, usage: "Thumb in uitstand" },
];

export type DesignSystemHubFontFamily = {
  name: string;
  purpose: string;
  example: string;
  source: string;
  status: "docs-backed" | "code-backup";
};

export const designSystemHubFontFamilies: DesignSystemHubFontFamily[] = [
  {
    name: "Manrope",
    purpose: "Body en labels",
    example: "Rustige, goed leesbare uitleg en metadata.",
    source: "docs/design/stitch-design-md.md",
    status: "docs-backed",
  },
  {
    name: "Inter",
    purpose: "Ondersteunende labels en metadata",
    example: "Gebruik als secundaire font-richting in de design docs.",
    source: "docs/design/stitch-design-md.md",
    status: "docs-backed",
  },
  {
    name: "Fonts.sans",
    purpose: "Huidige web fallback stack",
    example: Fonts?.sans ?? WEB_SANS_FALLBACK,
    source: "constants/theme.ts",
    status: "code-backup",
  },
  {
    name: "Fonts.mono",
    purpose: "Monospace voor code- of sync-snippets",
    example: Fonts?.mono ?? WEB_MONO_FALLBACK,
    source: "constants/theme.ts",
    status: "code-backup",
  },
];

export type DesignSystemHubTypographyToken = {
  key: keyof typeof FinTokens.typography;
  value: string;
  usage: string;
  sample: string;
};

export const designSystemHubTypographyTokens: DesignSystemHubTypographyToken[] = [
  { key: "label", value: "12 / 16 / 1.2", usage: "Korte labels", sample: "Labels en microcopy" },
  { key: "caption", value: "12 / 16 / 0.2", usage: "Metadata", sample: "Leidende bron · codebase" },
  { key: "body-sm", value: "14 / 20 / 0.1", usage: "Korte toelichting", sample: "Korte toelichting voor intern gebruik." },
  { key: "body", value: "16 / 24 / 0.1", usage: "Normale bodytekst", sample: "Gebruik voor uitleg en compacte paragrafen." },
  { key: "body-lg", value: "18 / 26 / 0", usage: "Rijkere uitleg", sample: "Gebruik als de copy meer lucht nodig heeft." },
  { key: "title-sm", value: "20 / 28 / -0.2", usage: "Sectietitels", sample: "Overzicht van bronnen en sync" },
  { key: "title", value: "24 / 32 / -0.4", usage: "Page subheads", sample: "Tokens en componenten" },
  { key: "h3", value: "28 / 36 / -0.6", usage: "Zwaardere koppen", sample: "Design governance" },
  { key: "h2", value: "34 / 42 / -0.8", usage: "Grote koppen", sample: "Interne referentie" },
  { key: "h1", value: "44 / 52 / -1.1", usage: "Hero-anker", sample: "Design System" },
];

export type DesignSystemHubSpacingToken = {
  key: keyof typeof FinTokens.spacing;
  value: number;
  usage: string;
};

export const designSystemHubSpacingTokens: DesignSystemHubSpacingToken[] = [
  { key: "none", value: FinTokens.spacing.none, usage: "Geen ruimte" },
  { key: "xxs", value: FinTokens.spacing.xxs, usage: "Micro spacing" },
  { key: "xs", value: FinTokens.spacing.xs, usage: "Compacte gaps" },
  { key: "xs-plus", value: FinTokens.spacing["xs-plus"], usage: "Compacte padding" },
  { key: "s", value: FinTokens.spacing.s, usage: "Kleine sectieruimte" },
  { key: "s-plus", value: FinTokens.spacing["s-plus"], usage: "Subtiele scheiding" },
  { key: "m", value: FinTokens.spacing.m, usage: "Standaard padding" },
  { key: "m-plus", value: FinTokens.spacing["m-plus"], usage: "Ruimere padding" },
  { key: "l", value: FinTokens.spacing.l, usage: "Blokafstand" },
  { key: "l-plus", value: FinTokens.spacing["l-plus"], usage: "Ruime blokafstand" },
  { key: "xl", value: FinTokens.spacing.xl, usage: "Grotere ritmes" },
  { key: "2xl", value: FinTokens.spacing["2xl"], usage: "Hero- en sectieruimte" },
  { key: "3xl", value: FinTokens.spacing["3xl"], usage: "Ruimte tussen blokken" },
  { key: "4xl", value: FinTokens.spacing["4xl"], usage: "Zeer ruime opmaak" },
];

export type DesignSystemHubRadiusToken = {
  key: keyof typeof FinTokens.radius;
  value: number;
  usage: string;
};

export const designSystemHubRadiusTokens: DesignSystemHubRadiusToken[] = [
  { key: "sm", value: FinTokens.radius.sm, usage: "Compacte elementen" },
  { key: "md", value: FinTokens.radius.md, usage: "Kleine controls" },
  { key: "lg", value: FinTokens.radius.lg, usage: "Kleine cards" },
  { key: "xl", value: FinTokens.radius.xl, usage: "Middelgrote cards" },
  { key: "xxl", value: FinTokens.radius.xxl, usage: "Grote cards" },
  { key: "sheet", value: FinTokens.radius.sheet, usage: "Bottom sheets" },
  { key: "pill", value: FinTokens.radius.pill, usage: "Chips en ronde CTA's" },
];

export type DesignSystemHubBorderToken = {
  key: string;
  value: string | number;
  usage: string;
  note?: string;
};

export const designSystemHubBorderTokens: DesignSystemHubBorderToken[] = [
  { key: "border", value: FinTokens.color.border, usage: "Zichtbare scheiding" },
  { key: "borderSubtle", value: FinTokens.color.borderSubtle, usage: "Rustige scheiding" },
  { key: "warningBorder", value: FinTokens.color.warningBorder, usage: "Waarschuwingsrand" },
  { key: "greenBorder", value: FinTokens.color.greenBorder, usage: "Succesrand" },
  { key: "redBorder", value: FinTokens.color.redBorder, usage: "Kritieke rand" },
  { key: "overlayBackdrop", value: FinTokens.color.overlayBackdrop, usage: "Modal backdrop" },
  { key: "overlayStrong", value: FinTokens.color.overlayStrong, usage: "Sterkere overlay" },
  {
    key: "borderWidth",
    value: 1,
    usage: "Technische breedte",
    note: "Nog niet als apart token gemodelleerd; gebruik bestaande componentranden.",
  },
];

export type DesignSystemHubShadowToken = {
  key: string;
  value: string;
  usage: string;
};

export const designSystemHubShadowTokens: DesignSystemHubShadowToken[] = [
  {
    key: "FinSurfaces.topLevelCard",
    value: "0px 6px 12px rgba(17,17,17,0.03)",
    usage: "Canonieke rustige card-shadow",
  },
  {
    key: "FinSurfaces.mainPageTintedCard",
    value: "0px 5px 12px rgba(17,17,17,0.04)",
    usage: "Gekleurde hoofdkaart",
  },
];

export type DesignSystemHubLeadFile = {
  label: string;
  path: string;
  detail: string;
};

export const designSystemHubLeadFiles: DesignSystemHubLeadFile[] = [
  {
    label: "AGENTS.md",
    path: "AGENTS.md",
    detail: "Project playbook, productregels en designwerkafspraken.",
  },
  {
    label: "Productcontract",
    path: "docs/BUDIO_PRODUCT_CONTRACT.md",
    detail: "Truth hierarchy en productbetekenis.",
  },
  {
    label: "Cockpit map",
    path: "docs/BUDIO_COCKPIT_MIGRATION_MAP.md",
    detail: "Welke schermen behouden, samenvouwen of migreren.",
  },
  {
    label: "UI patterns",
    path: "docs/UI_PATTERNS.md",
    detail: "Canonieke shell-, card- en modalpatronen.",
  },
  {
    label: "Screen inventory",
    path: "docs/design/screen-inventory.md",
    detail: "Route-inventaris en shellmapping.",
  },
  {
    label: "Design tokens",
    path: "docs/design/design-tokens.md",
    detail: "Gecatalogiseerde tokens uit constants/theme.ts.",
  },
  {
    label: "Design changelog",
    path: "docs/design/design-system-changelog.md",
    detail: "Canonical wijzigingslog voor de design-system hub.",
  },
  {
    label: "Component inventory",
    path: "docs/design/component-inventory.md",
    detail: "Canonieke componentfamilies en legacy-randen.",
  },
  {
    label: "Screen shells",
    path: "docs/design/screen-shells.md",
    detail: "Shellkeuzes per routefamilie.",
  },
  {
    label: "Stitch design",
    path: "docs/design/stitch-design-md.md",
    detail: "Visuele richting, typografie en surfaces.",
  },
  {
    label: "Stitch workflow",
    path: "docs/design/stitch-codex-workflow.md",
    detail: "Hoe Stitch vanuit Codex moet worden gebruikt.",
  },
  {
    label: "Theme tokens",
    path: "constants/theme.ts",
    detail: "Runtime bron voor kleuren, spacing, radius en shadows.",
  },
  {
    label: "Motion components",
    path: "components/motions/",
    detail: "Canonieke motioncomponenten en hooks voor assistant en loaders.",
  },
  {
    label: "Import start",
    path: "screens/CSVImportScreen.tsx",
    detail: "Bestand kiezen, drag/drop en draftopbouw.",
  },
  {
    label: "Import koppelen",
    path: "app/rekeningen-koppelen.tsx",
    detail: "Koppelstap met rekeningpicker en create-sheet.",
  },
  {
    label: "Import control",
    path: "app/import-control.tsx",
    detail: "Progress- en writescherm voor de importrun.",
  },
  {
    label: "Import afronden",
    path: "app/import-afronden.tsx",
    detail: "Resultaat- en vervolgstap na import.",
  },
  {
    label: "Bankrekeningen",
    path: "app/bankrekeningen.tsx",
    detail: "Utility-overzicht met create/edit/delete flows.",
  },
  {
    label: "Budget setup",
    path: "app/(tabs)/budget.tsx",
    detail: "Budget beheersegment binnen het budget-hoofdscherm.",
  },
  {
    label: "Quick menu",
    path: "components/navigation/finance-quick-menu.tsx",
    detail: "Canonieke hoofdmenu-footer voor tabs.",
  },
];

export type DesignSystemHubChangeChecklistItem = {
  label: string;
  detail: string;
};

export const designSystemHubChangeChecklist: DesignSystemHubChangeChecklistItem[] = [
  {
    label: "constants/theme.ts",
    detail: "Nieuwe of gewijzigde tokens komen eerst hier terecht.",
  },
  {
    label: "docs/design/design-tokens.md",
    detail: "Tokenwijzigingen en interpretatie blijven hier zichtbaar.",
  },
  {
    label: "docs/design/component-inventory.md",
    detail: "Nieuwe gedeelde componentfamilies of statuswijzigingen.",
  },
  {
    label: "docs/design/screen-inventory.md",
    detail: "Nieuwe routes, subroutes of shellwijzigingen.",
  },
  {
    label: "docs/UI_PATTERNS.md",
    detail: "Als de shell-, card- of modaltaal verandert.",
  },
  {
    label: "docs/design/stitch-design-md.md",
    detail: "Als de designrichting of Stitch-bronafspraak verandert.",
  },
  {
    label: "docs/design/stitch-project-registry.md",
    detail: "Wanneer Stitch project- of assetregistratie wijzigt.",
  },
  {
    label: "Importflow routes",
    detail: "Bij UI-wijzigingen in import: update screen-inventory + patterns + componentnotes.",
  },
  {
    label: "Accounts en budget setup",
    detail: "Bij shell- of flowwijzigingen ook bankrekeningen/budget setup routecontext bijwerken.",
  },
  {
    label: "Hoofdmenu navigatie",
    detail: "Wijzigingen aan docked tabbar/quick-menu moeten terugkomen in patterns en componentinventaris.",
  },
  {
    label: "Motion contract",
    detail: "Werk motion-hooks/componenten en UI-patroondocumentatie tegelijk bij.",
  },
];

export const designSystemHubTokenGroups: DesignSystemHubTokenGroup[] = [
  {
    title: "Kleuren",
    subtitle: "De live kleurbron komt rechtstreeks uit `constants/theme.ts`.",
    items: [
      { key: "bgBase", value: FinTokens.color.bgBase, usage: "App-basisachtergrond" },
      { key: "topBarBg", value: FinTokens.color.topBarBg, usage: "Topbars en admin shell" },
      { key: "bgCard", value: FinTokens.color.bgCard, usage: "Primaire kaarten" },
      { key: "bgElevated", value: FinTokens.color.bgElevated, usage: "Zachte elevated oppervlakken" },
      { key: "bgInput", value: FinTokens.color.bgInput, usage: "Inputs en subtiele keuzes" },
      { key: "bgCardSoftCool", value: FinTokens.color.bgCardSoftCool, usage: "Koele hoofdkaart" },
      { key: "textPrimary", value: FinTokens.color.textPrimary, usage: "Hoofdtekst en bedragen" },
      { key: "textSecondary", value: FinTokens.color.textSecondary, usage: "Secundaire uitleg" },
      { key: "textMuted", value: FinTokens.color.textMuted, usage: "Subtiele metadata" },
      { key: "yellow", value: FinTokens.color.yellow, usage: "Functioneel accent" },
      { key: "warningText", value: FinTokens.color.warningText, usage: "Waarschuwingen" },
      { key: "green", value: FinTokens.color.green, usage: "Succes en positief signaal" },
      { key: "red", value: FinTokens.color.red, usage: "Fout en kritisch signaal" },
      { key: "border", value: FinTokens.color.border, usage: "Zichtbare scheiding" },
      { key: "borderSubtle", value: FinTokens.color.borderSubtle, usage: "Rustige scheiding" },
      { key: "overlayBackdrop", value: FinTokens.color.overlayBackdrop, usage: "Backdrops en overlays" },
    ],
  },
  {
    title: "Spacing",
    subtitle: "Alle spacing volgt de gedeelde 4px-schaal.",
    items: [
      { key: "xs", value: FinTokens.spacing.xs, usage: "Kleine gaps" },
      { key: "s", value: FinTokens.spacing.s, usage: "Kleine sectieruimte" },
      { key: "m", value: FinTokens.spacing.m, usage: "Standaard padding" },
      { key: "l", value: FinTokens.spacing.l, usage: "Ruimere blokafstand" },
      { key: "xl", value: FinTokens.spacing.xl, usage: "Grotere ritmes" },
      { key: "2xl", value: FinTokens.spacing["2xl"], usage: "Hero- en sectieruimte" },
      { key: "3xl", value: FinTokens.spacing["3xl"], usage: "Ruimte tussen blokken" },
      { key: "4xl", value: FinTokens.spacing["4xl"], usage: "Zeer ruime opmaak" },
    ],
  },
  {
    title: "Radius",
    subtitle: "De bestaande radius-schaal houdt kaarten en sheets consistent.",
    items: [
      { key: "sm", value: FinTokens.radius.sm, usage: "Compacte elementen" },
      { key: "md", value: FinTokens.radius.md, usage: "Kleine controls" },
      { key: "lg", value: FinTokens.radius.lg, usage: "Kleine cards" },
      { key: "xl", value: FinTokens.radius.xl, usage: "Middelgrote cards" },
      { key: "xxl", value: FinTokens.radius.xxl, usage: "Grotere cards" },
      { key: "sheet", value: FinTokens.radius.sheet, usage: "Bottom-sheets" },
      { key: "pill", value: FinTokens.radius.pill, usage: "Chips en badges" },
    ],
  },
  {
    title: "Typografie",
    subtitle: "Gebruik `FinanceText` en de shared type scale waar mogelijk.",
    items: [
      { key: "label", value: "12 / 16", usage: "Compacte labels" },
      { key: "caption", value: "12 / 16", usage: "Metadata" },
      { key: "body-sm", value: "14 / 20", usage: "Korte toelichting" },
      { key: "body", value: "16 / 24", usage: "Normale bodytekst" },
      { key: "body-lg", value: "18 / 26", usage: "Rijkere uitleg" },
      { key: "title-sm", value: "20 / 28", usage: "Sectietitels" },
      { key: "title", value: "24 / 32", usage: "Grote contentkoppen" },
      { key: "h1", value: "44 / 52", usage: "Hero-anker" },
    ],
  },
  {
    title: "Surfaces",
    subtitle: "De surfaces zijn de canonieke visuele bouwstenen voor kaarten en shells.",
    items: [
      { key: "surface", value: FinTokens.color.surface, usage: "Primaire kaart" },
      { key: "surfaceSoft", value: FinTokens.color.surfaceSoft, usage: "Zachte elevated kaart" },
      { key: "surfaceMuted", value: FinTokens.color.surfaceMuted, usage: "Subtiele input of helper" },
      { key: "surfaceSoftCool", value: FinTokens.color.surfaceSoftCool, usage: "Koele hoofdkaart" },
      { key: "topLevelCard", value: "0px 6px 12px", usage: "Shared shadow" },
      { key: "mainPageTintedCard", value: "0px 5px 12px", usage: "Tinted card shadow" },
    ],
  },
];

export const designSystemHubComponentFamilies: DesignSystemHubComponentFamily[] = [
  {
    title: "Shells",
    status: "canoniek",
    source: "components/ui/finance-admin-shell.tsx, finance-utility-shell.tsx, finance-detail-shell.tsx, finance-top-bar.tsx, finance-dashboard-header.tsx",
    usedIn: "Admin, dashboard, utility- en detailschermen",
    note: "De shell bepaalt ritme, topbar, contentkolom en headeracties. Geen schermspecifieke shell opnieuw uitvinden.",
    items: [
      "FinanceAdminShell",
      "FinanceUtilityShell",
      "FinanceDetailShell",
      "FinanceTopBar",
      "FinanceDashboardHeader",
      "FinanceHeaderActions",
      "FinanceDetailTopBar",
    ],
  },
  {
    title: "Navigatie & quick menu",
    status: "canoniek",
    source: "components/navigation/docked-tab-bar.tsx, finance-quick-menu.tsx, app/(tabs)/_layout.tsx",
    usedIn: "Alle hoofdschermen (Dashboard, Transacties, Insights, Budget)",
    note: "Het docked quick menu is de gedeelde footer-navigatie. Niet per scherm namaken.",
    items: ["DockedTabBar", "FinanceQuickMenu", "FINANCE_QUICK_MENU_ITEMS", "MainPageSpacing"],
  },
  {
    title: "Hero en secties",
    status: "canoniek",
    source: "components/ui/finance-hero-shell.tsx, finance-section-header.tsx",
    usedIn: "Hoofdschermen en interne beheerlagen",
    note: "Hero-ritme en sectiekoppen zijn gedeelde bouwstenen voor rustige hiërarchie.",
    items: ["FinanceHeroShell", "FinanceSectionHeader", "FinanceDashboardHeader"],
  },
  {
    title: "Kaarten en callouts",
    status: "in gebruik",
    source: "components/ui/finance-detail-card.tsx, finance-inline-callout.tsx, finance-insight-card.tsx",
    usedIn: "Details, helpers en samenvattingen",
    note: "Gebruik eerst bestaande kaarten voordat er een nieuw patroon ontstaat.",
    items: [
      "FinanceDetailCard",
      "FinanceInlineCallout",
      "FinanceInsightCard",
      "FinanceForecastSummaryCard",
      "FinanceCategorySummaryCard",
    ],
  },
  {
    title: "Acties",
    status: "canoniek",
    source: "components/ui/finance-button.tsx, finance-pressable-surface.tsx",
    usedIn: "CTA's, compacte acties en klikbare oppervlakken",
    note: "Nieuwe admin-acties moeten in de bestaande buttonfamilie passen.",
    items: ["FinanceButton", "FinancePressableSurface", "FinanceCircleIconButton"],
  },
  {
    title: "Status en selectie",
    status: "in gebruik",
    source: "components/ui/finance-status-chip.tsx, finance-month-selector.tsx, finance-bottom-sheet-shell.tsx",
    usedIn: "Chips, sheets en selectorflows",
    note: "Korte labels, duidelijke state en gedeelde sheet-opbouw houden de flows rustig.",
    items: ["FinanceStatusChip", "FinanceMonthSelector", "FinanceBottomSheetShell"],
  },
  {
    title: "Form inputs",
    status: "canoniek",
    source: "components/ui/finance-input-field.tsx, app/auth/*, components/bank-accounts/bank-account-form-sheet.tsx",
    usedIn: "Auth, bankrekening create/edit, import-account linking",
    note: "Gebruik FinanceInputField als standaard. Losse TextInput-varianten zijn alleen voor legacy of specialistische editorflows.",
    items: [
      "FinanceInputField",
      "FinanceInputField (secure)",
      "FinanceInputField (keyboardType)",
      "TextInput (legacy patroon)",
    ],
  },
  {
    title: "Lijst en tekst",
    status: "in gebruik",
    source: "components/ui/finance-text.tsx, transaction-list-row.tsx, finance-settings-row.tsx",
    usedIn: "Rows, metadata en compacte uitleg",
    note: "Tekst en rijen blijven scanbaar, zonder technische overload.",
    items: ["FinanceText", "TransactionListRow", "FinanceSettingsRow", "FinanceSettingsGroup"],
  },
  {
    title: "Dashboard cockpitblokken",
    status: "in gebruik",
    source: "components/dashboard/dashboard-balance-summary.tsx, dashboard-overview-card.tsx, dashboard-assistant-callout.tsx",
    usedIn: "Dashboard home-cockpit",
    note: "Dominante stand, weektempo en assistent-callout op het primaire homescherm.",
    items: ["DashboardBalanceSummary", "DashboardBudgetOverviewCard", "DashboardAssistantCallout"],
  },
  {
    title: "Budget cockpitblokken",
    status: "in gebruik",
    source: "components/budget-month-summary-card.tsx, budget-week-rhythm-card.tsx, budget-pressure-list.tsx",
    usedIn: "Budget sturing en correctieflow",
    note: "Maand/week ritme, drukpunten en categorieprogressie vormen samen de budget-opbouw.",
    items: [
      "BudgetMonthSummaryCard",
      "BudgetWeekRhythmCard",
      "BudgetPressureList",
      "BudgetCategoryProgressRow",
      "BudgetAmountSlider",
    ],
  },
  {
    title: "Insights cockpitblokken",
    status: "in gebruik",
    source: "components/ui/finance-forecast-summary-card.tsx, finance-category-summary-card.tsx, finance-upcoming-moments-card.tsx",
    usedIn: "Insights maandcontext en verwachtingsuitleg",
    note: "Forecast, categoriecontext en komende momenten horen samen bij de insight-opbouw.",
    items: [
      "FinanceForecastSummaryCard",
      "FinanceCategorySummaryCard",
      "FinanceUpcomingMomentsCard",
      "FinanceInsightCard",
      "FinanceScopeSwitch",
      "FinanceMonthSelectorModal",
    ],
  },
  {
    title: "Import utilityflow",
    status: "in gebruik",
    source: "screens/CSVImportScreen.tsx, app/rekeningen-koppelen.tsx, app/import-control.tsx, app/import-afronden.tsx",
    usedIn: "Bestand kiezen, rekening koppelen, schrijven en afronden",
    note: "Flow blijft stap-gestuurd met één gedeelde indicator en gedeelde sheets voor accountkeuze.",
    items: [
      "FinanceStepIndicator",
      "ImportBankAccountSheet",
      "BankAccountFormSheet",
      "FinanceBottomSheetShell",
      "FinanceDetailShell",
    ],
  },
  {
    title: "Bankrekeningbeheer",
    status: "in gebruik",
    source: "app/bankrekeningen.tsx, components/bank-accounts/bank-account-form-sheet.tsx",
    usedIn: "Accounts overzicht, create/edit/delete",
    note: "Utility-overzicht met rustige lijstpresentatie en duidelijke delete-confirmatieflow.",
    items: [
      "BankAccountFormSheet",
      "FinanceUtilityShell",
      "FinanceBottomSheetShell",
      "FinanceButton",
    ],
  },
  {
    title: "Budget setup flow",
    status: "legacy",
    source: "app/(tabs)/budget.tsx",
    usedIn: "Beheersegment binnen budgettab",
    note: "Beheer is aanwezig maar nog grotendeels inline; centralisatie naar gedeelde beheercomponenten is kandidaat.",
    items: ["Budget manage segment (inline)", "FinanceBottomSheetShell", "FinanceSettingsGroup"],
  },
  {
    title: "Inline route-UI kandidaten",
    status: "legacy",
    source: "app/bankrekeningen.tsx, app/rekeningen-koppelen.tsx, app/import-control.tsx",
    usedIn: "Meerdere utilityroutes met lokale card/row varianten",
    note: "Deze schermen bevatten nog inline kaartvarianten; centralisatie naar gedeelde componenten is aanbevolen.",
    items: ["StatusPill-local", "AccountRow-local", "ImportProgressCard-local"],
  },
];

export const designSystemHubMotionFamilies: DesignSystemHubMotionFamily[] = [
  {
    title: "Assistant micro-motion",
    status: "canoniek",
    source: "components/motions/finance-assistant-motion-glyph.tsx, finance-assistant-motion-button.tsx, finance-live-status-dot-motion.tsx, use-finance-assistant-motion.ts",
    usedIn: "Assistant trigger, help-assistant modal, quick actions",
    note: "Kleine ritmische motion voor herkenning en aandacht zonder visuele onrust.",
    items: [
      "FinanceAssistantMotionGlyph",
      "FinanceAssistantMotionButton",
      "FinanceLiveStatusDotMotion",
      "useFinanceAssistantMotion",
    ],
  },
  {
    title: "Loader motion",
    status: "in gebruik",
    source: "components/motions/SplashLoader.tsx, useSplashLoaderAnimation.ts",
    usedIn: "Splash, opstart- en loading-contexten",
    note: "Gebruik deze alleen bij echte wachttijd. Respecteer reduce-motion altijd.",
    items: ["SplashLoader", "useSplashLoaderAnimation"],
  },
  {
    title: "Assistant empty-state motion",
    status: "in gebruik",
    source: "components/motions/useBudioAssistantEmptyStateAnimation.ts",
    usedIn: "Assistant empty states en contextuele onboarding",
    note: "Hook-gedreven animatie voor subtiele, ambient states. Niet voor primaire CTA-animaties.",
    items: ["useBudioAssistantEmptyStateAnimation"],
  },
];

export const designSystemHubPatternBlocks: DesignSystemHubPatternBlock[] = [
  {
    title: "Admin shell en navigatie",
    useWhen: "Je in admin snel wilt switchen tussen observability, design reference en onderhoud.",
    avoidWhen: "Je een nieuw productscherm bouwt; dan hoort een hoofd- of utility-shell te gelden.",
    sources: ["docs/design/screen-shells.md", "components/ui/finance-admin-shell.tsx"],
  },
  {
    title: "Kaarten en keuzevakken",
    useWhen: "Je informatie rustig wilt clusteren zonder extra productnarratief.",
    avoidWhen: "De kaart vooral decoratief is of dezelfde informatie al ergens anders luid staat.",
    sources: ["docs/UI_PATTERNS.md", "components/ui/finance-detail-card.tsx"],
  },
  {
    title: "Topbar, hero en sectiekoppen",
    useWhen: "Je een scanbare hiërarchie wilt met duidelijke ankerpunten.",
    avoidWhen: "Een nieuw scherm nog geen duidelijke shell-keuze heeft.",
    sources: ["docs/UI_PATTERNS.md", "components/ui/finance-hero-shell.tsx"],
  },
  {
    title: "Sheets en selectors",
    useWhen: "Je een beheerflow of keuze wilt tonen zonder de huidige context te verliezen.",
    avoidWhen: "Een volledige pagina moet vervangen worden door een mini-modal.",
    sources: ["docs/UI_PATTERNS.md", "components/ui/finance-bottom-sheet-shell.tsx"],
  },
  {
    title: "Motion met intentie",
    useWhen: "Je status, aandacht of laadcontext subtiel wilt ondersteunen met bestaande motioncomponenten.",
    avoidWhen: "Motion puur decoratief is of de hiërarchie van bedragen, risico of actie overstemt.",
    sources: [
      "components/motions/finance-assistant-motion-glyph.tsx",
      "components/motions/finance-live-status-dot-motion.tsx",
      "components/motions/SplashLoader.tsx",
      "docs/UI_PATTERNS.md",
    ],
  },
  {
    title: "Admin design hub",
    useWhen: "Designers en developers snel tokens, componenten, patronen en Stitch-bronnen nodig hebben.",
    avoidWhen: "Je een visueel showcase-scherm wilt zonder praktische bronverwijzing.",
    sources: ["app/admin/design-system/index.tsx", "services/design-system-hub.ts"],
  },
  {
    title: "Import step flow",
    useWhen: "Je een meerstaps utilityflow hebt met verplicht volgpad (kiezen, koppelen, verwerken, afronden).",
    avoidWhen: "Je flow geen harde volgorde of validatiestappen heeft.",
    sources: ["components/ui/finance-step-indicator.tsx", "components/import/import-flow-steps.ts"],
  },
  {
    title: "Accounts utility beheer",
    useWhen: "Je bestaande rekeningen rustig wilt beheren met create/edit/delete in dezelfde context.",
    avoidWhen: "Je rekeningbeheer in een hoofdschermshell wilt drukken.",
    sources: ["app/bankrekeningen.tsx", "components/bank-accounts/bank-account-form-sheet.tsx"],
  },
  {
    title: "Budget beheer setup",
    useWhen: "Je binnen Budget duidelijke scheiding wilt tussen maand, week en beheer.",
    avoidWhen: "Je beheeracties als losse schermexplosie buiten de budgetcontext bouwt.",
    sources: ["app/(tabs)/budget.tsx", "docs/UI_PATTERNS.md"],
  },
];

export const designSystemHubSources: DesignSystemHubSourceItem[] = [
  {
    label: "Codebron",
    detail: "constants/theme.ts is de primaire runtime bron voor tokens en surfaces.",
  },
  {
    label: "Design docs",
    detail:
      "docs/design/design-tokens.md, docs/UI_PATTERNS.md, docs/design/screen-inventory.md en docs/design/screen-shells.md vormen de repo-context.",
  },
  {
    label: "Stitch project",
    detail:
      `${designSystemHubMeta.stitchProjectName} · ${designSystemHubMeta.stitchProjectId} · asset ${designSystemHubMeta.canonicalAssetId}`,
  },
  {
    label: "Canonical asset",
    detail:
      `${designSystemHubMeta.canonicalAssetDisplayName} · versie ${designSystemHubMeta.canonicalAssetVersion}`,
  },
  {
    label: "Sync-regel",
    detail:
      "Werk eerst de repo-docs bij, verifieer daarna Stitch-state en houd de kanonieke asset gelijk.",
  },
];

export const designSystemHubDesignChangeNotes = [
  "Werk eerst de codebron en de design-docs bij.",
  "Controleer daarna of Stitch project en canonical asset nog matchen.",
  "Werk pas daarna de admin hub zelf bij zodat de referentie synchroon blijft.",
] as const;

export const designSystemHubSyncCommands = [
  "npm run stitch:codex:setup",
  "codex mcp get stitch",
  "npm run stitch:tool -- list_design_systems -d '{\"projectId\":\"12076228720239525233\"}'",
  "npm run stitch:tool -- get_project -d '{\"name\":\"projects/12076228720239525233\"}'",
] as const;

export const designSystemHubChangelogEntries: DesignSystemHubChangelogEntry[] = [
  {
    date: "2026-03-29",
    title: "Admin design system hub toegevoegd",
    summary:
      "Er is een admin-only referentiepunt toegevoegd voor tokens, componenten, patronen, Stitch-bronnen en sync-richtlijnen.",
  },
  {
    date: "2026-03-29",
    title: "Single design system policy zichtbaar gemaakt",
    summary:
      "De canonieke Stitch asset en het actieve project zijn nu expliciet terug te vinden in de interne design-context.",
  },
  {
    date: "2026-03-29",
    title: "Design docs samengebracht",
    summary:
      "De hub verwijst nu naar de codebase en de design-docs als gezamenlijke bron van waarheid in plaats van losse screenshots.",
  },
];

export const designSystemHubFlowCoverage: DesignSystemHubFlowCoverage[] = [
  {
    area: "Import flow",
    routes: ["/csv-import", "/accounts/link", "/import-control", "/import-afronden"],
    shell: "FinanceDetailShell + FinanceBottomSheetShell + FinanceStepIndicator",
    componentFocus: [
      "FinanceStepIndicator",
      "ImportBankAccountSheet",
      "BankAccountFormSheet",
      "FinanceBottomSheetShell",
    ],
    tokenFocus: [
      "FinColors.warningText / warningBg",
      "FinSurfaces.topLevelCard",
      "FinSpacing m/l/2xl",
      "FinRadius xl/pill",
    ],
    patternFocus: [
      "4-staps flow met vaste voortgang",
      "Navigatie blokkeren tijdens schrijven",
      "Selector/create in gedeelde sheet-shell",
    ],
    sourceFocus: [
      "screens/CSVImportScreen.tsx",
      "app/rekeningen-koppelen.tsx",
      "app/import-control.tsx",
      "app/import-afronden.tsx",
      "components/import/import-flow-steps.ts",
    ],
    dataMode: "mixed",
    attention:
      "Statuspills en sommige rijopmaak leven nog schermspecifiek; kandidaat voor centralisatie.",
  },
  {
    area: "Bankrekeningen",
    routes: ["/bankrekeningen"],
    shell: "FinanceUtilityShell + FinanceBottomSheetShell",
    componentFocus: [
      "BankAccountFormSheet",
      "FinanceButton",
      "FinanceBottomSheetShell",
      "AppIcon",
    ],
    tokenFocus: [
      "FinTokens.typography",
      "FinColors.bgElevated / borderSubtle",
      "FinRadius xl/pill",
      "FinSpacing m/l",
    ],
    patternFocus: [
      "Rustige utility-lijst met statuscontext",
      "Create/edit in gedeelde form-sheet",
      "Delete confirmation in modal-shell",
    ],
    sourceFocus: [
      "app/bankrekeningen.tsx",
      "components/bank-accounts/bank-account-form-sheet.tsx",
      "components/bank-accounts/account-overview-summary.ts",
    ],
    dataMode: "mixed",
    attention:
      "Een deel van de lijstkaartstructuur staat nog inline in de route; centralisatie kan later.",
  },
  {
    area: "Hoofdmenu",
    routes: ["/(tabs)/*"],
    shell: "DockedTabBar + FinanceQuickMenu",
    componentFocus: ["DockedTabBar", "FinanceQuickMenu", "FINANCE_QUICK_MENU_ITEMS"],
    tokenFocus: [
      "FinColors.tabInactive",
      "FinColors.yellow",
      "FinColors.borderSubtle",
      "FinRadius 24 / pill",
    ],
    patternFocus: [
      "Docked footer over hoofdschermen",
      "Actieve tab via kleur + icon/label state",
      "Geen schermspecifieke variant per tab",
    ],
    sourceFocus: [
      "app/(tabs)/_layout.tsx",
      "components/navigation/docked-tab-bar.tsx",
      "components/navigation/finance-quick-menu.tsx",
    ],
    dataMode: "live",
    attention:
      "Als labels of volgorde wijzigen, ook routes + screen-inventory + patterns bijwerken.",
  },
  {
    area: "Budget beheer",
    routes: ["/budget (segment manage/manage_new)"],
    shell: "FinanceHeroShell + lokale beheerblokken + FinanceBottomSheetShell",
    componentFocus: [
      "FinanceSettingsGroup",
      "FinanceSettingsRow",
      "FinanceBottomSheetShell",
      "FinanceScopeSwitch",
      "BudgetMonthSummaryCard",
      "BudgetWeekRhythmCard",
    ],
    tokenFocus: [
      "FinTypography budget-title styles",
      "FinColors budgetProgress*",
      "MainPageSpacing.budgetComponents",
      "FinSurfaces.mainPageTintedCard",
    ],
    patternFocus: [
      "Dag/week/maand/beheer scheiden",
      "Setupflow met start/analyse/voorstel/refine",
      "Block-level edit sheets i.p.v. losse schermexplosie",
    ],
    sourceFocus: [
      "app/(tabs)/budget.tsx",
      "docs/design/screen-inventory.md",
      "docs/UI_PATTERNS.md",
    ],
    dataMode: "mixed",
    attention:
      "Beheersegment gebruikt veel inline-UI; expliciete gedeelde beheercomponenten ontbreken nog.",
  },
];

export const designSystemHubSurfaceNotes = {
  adminShell: FinSurfaces.topLevelCard,
  tintedCard: FinSurfaces.mainPageTintedCard,
};
