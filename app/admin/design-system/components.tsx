import { BudgetAmountSlider } from "@/components/budget-amount-slider";
import { BudgetCategoryProgressRow } from "@/components/budget-category-progress-row";
import { BudgetManageDistributionGroup } from "@/components/budget/budget-manage-distribution-group";
import { BudgetManageIncomeSourcesGroup } from "@/components/budget/budget-manage-income-sources-group";
import { BudgetManageObligationsGroup } from "@/components/budget/budget-manage-obligations-group";
import { BudgetMonthActionCard } from "@/components/budget/budget-month-action-card";
import { BudgetMonthSummaryCard } from "@/components/budget-month-summary-card";
import { BudgetPressureList } from "@/components/budget-pressure-list";
import { BudgetWeekRhythmCard } from "@/components/budget-week-rhythm-card";
import { DashboardAssistantCallout } from "@/components/dashboard/dashboard-assistant-callout";
import { DashboardBalanceSummary } from "@/components/dashboard/dashboard-balance-summary";
import { buildDashboardBudgetOverviewModel, DashboardBudgetOverviewCard } from "@/components/dashboard/dashboard-overview-card";
import { BankAccountOverviewRow } from "@/components/bank-accounts/bank-account-overview-row";
import { BankAccountFormSheet } from "@/components/bank-accounts/bank-account-form-sheet";
import { FinanceAssistantMotionButton } from "@/components/motions/finance-assistant-motion-button";
import { FinanceAssistantMotionGlyph } from "@/components/motions/finance-assistant-motion-glyph";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinanceQuickMenu } from "@/components/navigation/finance-quick-menu";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceCategorySummaryCard } from "@/components/ui/finance-category-summary-card";
import { FinanceCategoryGroupCard, FinanceCategoryLeafRow, FinanceFlatChoiceCard } from "@/components/ui/finance-category-sheet";
import { FinanceCircleIconButton } from "@/components/ui/finance-circle-icon-button";
import { FinanceDashboardHeader } from "@/components/ui/finance-dashboard-header";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceForecastSummaryCard } from "@/components/ui/finance-forecast-summary-card";
import { FinanceHeaderActions } from "@/components/ui/finance-header-actions";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceInsightCard } from "@/components/ui/finance-insight-card";
import { FinanceInlineCallout } from "@/components/ui/finance-inline-callout";
import { FinanceInputField } from "@/components/ui/finance-input-field";
import { FinanceMonthSelector } from "@/components/ui/finance-month-selector";
import { FinancePrimaryCtaButton } from "@/components/ui/finance-primary-cta-button";
import { FinanceScopeSwitch } from "@/components/ui/finance-scope-switch";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceSettingsRow } from "@/components/ui/finance-settings-row";
import { FinanceStatusChip } from "@/components/ui/finance-status-chip";
import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinanceText } from "@/components/ui/finance-text";
import { FinanceTopBar } from "@/components/ui/finance-top-bar";
import { FinanceUpcomingMomentsCard } from "@/components/ui/finance-upcoming-moments-card";
import { IMPORT_FLOW_STEPS } from "@/components/import/import-flow-steps";
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
import type { InsightsCategorySummaryModel } from "@/services/insights-category-summary";
import type { InsightsForecastCardModel } from "@/services/insights-forecast-card";
import type { InsightsUpcomingMoment } from "@/services/insights-upcoming-moments";
import { TransactionListRow } from "@/components/transactions/transaction-list-row";
import {
  designSystemHubComponentFamilies,
  designSystemHubFlowCoverage,
  designSystemHubSections,
} from "@/services/design-system-hub";
import type { CategoryRecord } from "@/types/categorization";
import { useRouter, type Href } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";

const mockCategoryById = new Map<string, CategoryRecord>([
  [
    "cat_food",
    {
      id: "cat_food",
      key: "food",
      name: "Bood & drinken",
      parent_id: null,
      budget_group: "variable",
      sort_order: 10,
    },
  ],
]);

const monthLabel = "Maart 2026";
const dashboardMonthLabel = "maart 2026";

const mockForecastCardModel: InsightsForecastCardModel = {
  title: "Verwacht eindsaldo",
  amountLabel: "€ 1.248",
  currentOperationalValue: "€ 1.784",
  freeToSpendNowValue: "€ 462",
  reservedValue: "€ 820",
  statusLabel: "Op schema",
  statusTone: "good",
  confidenceLabel: "Hoge zekerheid",
  lowestOperationalPointValue: "€ 936",
  lowestOperationalPointDateLabel: "24 maart",
  explanation: "Gebaseerd op bekende inkomsten, vaste lasten en huidige uitgavetempo.",
  explanationItems: [
    "Vaste lasten en abonnementen zijn verwerkt.",
    "Vrij besteedbaar sluit aan op je actuele maandruimte.",
  ],
  isFallback: false,
};

const mockCategorySummaryModel: InsightsCategorySummaryModel = {
  mode: "open",
  title: "Verwachte grootste uitgaven",
  subtitle: "Gebaseerd op geplande lasten en budgetritme",
  rows: [
    {
      categoryKey: "fixed_costs",
      label: "Vaste lasten",
      amountLabel: "€ 1.020",
      amountValue: 1020,
      amountKind: "planned",
      statusLabel: "Gepland",
      contextLabel: "Huur, energie en verzekeringen",
      progress: 0.64,
      progressTone: "watch",
    },
    {
      categoryKey: "groceries",
      label: "Boodschappen",
      amountLabel: "€ 410",
      amountValue: 410,
      amountKind: "expected",
      statusLabel: "Verwacht",
      contextLabel: "€ 290 besteed, tempo licht hoger",
      progress: 0.71,
      progressTone: "watch",
    },
  ],
  emptyTitle: "Nog geen categorieën",
  emptyDescription: "Deze maand heeft nog geen bruikbare categoriecontext.",
};

const mockUpcomingMoments: InsightsUpcomingMoment[] = [
  {
    id: "moment-salary",
    dateIso: "2026-03-25",
    dayLabel: "25",
    monthLabel: "MRT",
    title: "Salaris",
    subtitle: "Verwacht inkomen",
    amountLabel: "+ € 2.450",
    amountTone: "income",
  },
  {
    id: "moment-rent",
    dateIso: "2026-03-28",
    dayLabel: "28",
    monthLabel: "MRT",
    title: "Huur",
    subtitle: "Vaste lasten",
    amountLabel: "- € 1.050",
    amountTone: "expense",
  },
];

const mockBankAccount = {
  id: "acc_demo_1",
  user_id: "demo-user",
  name: "Gezamenlijke betaalrekening",
  account_type: "checking",
  provider: "Rabobank",
  account_masked: "********9805",
  include_in_budget: true,
  include_in_cashflow: true,
  include_in_net_worth: true,
  owner_scope: "shared",
  forecast_role: "operational",
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as const;

function BlockCard({
  title,
  subtitle,
  source,
  children,
}: {
  title: string;
  subtitle: string;
  source: string;
  children: React.ReactNode;
}) {
  return (
    <FinanceDetailCard
      title={title}
      subtitle={subtitle}
      rightSlot={
        <FinanceText variant="caption" tone="muted">
          {source}
        </FinanceText>
      }
    >
      {children}
    </FinanceDetailCard>
  );
}

function MiniStat({
  label,
  value,
  tone = "secondary",
}: {
  label: string;
  value: string;
  tone?: "primary" | "secondary" | "muted";
}) {
  return (
    <View style={styles.miniStat}>
      <FinanceText variant="caption" tone="muted" weight="bold">
        {label}
      </FinanceText>
      <FinanceText variant="title-sm" tone={tone} weight="extrabold">
        {value}
      </FinanceText>
    </View>
  );
}

function PreviewFrame({ children }: { children: React.ReactNode }) {
  return <View style={styles.previewFrame}>{children}</View>;
}

function resolveFamilyStatusTone(status: "canoniek" | "in gebruik" | "legacy") {
  if (status === "canoniek") return "good" as const;
  if (status === "legacy") return "critical" as const;
  return "watch" as const;
}

async function copyToClipboard(value: string) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return false;
  const webNavigator = (globalThis as { navigator?: { clipboard?: { writeText?: (text: string) => Promise<void> } } }).navigator;
  if (Platform.OS === "web" && webNavigator?.clipboard?.writeText) {
    await webNavigator.clipboard.writeText(safeValue);
    return true;
  }
  return false;
}

function ComponentPreviewItem({
  title,
  copyValue,
  onCopy,
  copied,
  children,
}: {
  title: string;
  copyValue: string;
  onCopy: (value: string) => void;
  copied: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.previewItem}>
      <View style={styles.previewItemHeader}>
        <FinanceText variant="body-sm" weight="bold" tone="primary">
          {title}
        </FinanceText>
        <Pressable
          accessibilityRole="button"
          onPress={() => onCopy(copyValue)}
          style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
        >
          <FinanceText variant="caption" tone={copied ? "primary" : "secondary"} weight="bold">
            {copied ? "Gekopieerd" : "Kopieer naam"}
          </FinanceText>
        </Pressable>
      </View>
      <PreviewFrame>{children}</PreviewFrame>
    </View>
  );
}

function ShellSource({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.shellSource}>
      <FinanceText variant="body-sm" weight="bold" tone="primary">
        {title}
      </FinanceText>
      <FinanceText variant="caption" tone="muted">
        {description}
      </FinanceText>
    </View>
  );
}

export default function DesignSystemComponentsScreen() {
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [bankFormSheetOpen, setBankFormSheetOpen] = React.useState(false);
  const [scopePreview, setScopePreview] = React.useState<"personal" | "shared" | "household">("personal");
  const [sliderValue, setSliderValue] = React.useState(300);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const router = useRouter();
  const quickLinks = designSystemHubSections.filter((section) => section.id !== "components");

  const sectionCount = designSystemHubComponentFamilies.length;
  const handleCopy = React.useCallback((value: string) => {
    void copyToClipboard(value).then((ok) => {
      if (!ok) return;
      setCopiedKey(value);
      setTimeout(() => {
        setCopiedKey((current) => (current === value ? null : current));
      }, 1200);
    });
  }, []);

  return (
    <View style={designSystemSharedStyles.pageStack}>
      <FinanceHeroShell
        eyebrow="Admin design system"
        title="Echte componenten uit de codebase"
        subtitle="Een interne block-catalogus met previews van de componentfamilies die Budio al heeft. Geen showcase-televisie, wel praktische bouwstenen."
      >
        <View style={styles.heroRow}>
          <FinancePrimaryCtaButton
            label="Open sheet preview"
            onPress={() => setSheetOpen(true)}
          />
          <FinanceButton
            label="Bekijk bronnen"
            variant="secondary"
            onPress={() => router.push("/admin/design-system/sources" as Href)}
          />
          <FinanceStatusChip label="Echt component" tone="good" />
          <FinanceStatusChip label="Admin only" tone="critical" />
        </View>
      </FinanceHeroShell>

      <View style={styles.statRow}>
        <MiniStat label="Componentfamilies" value={`${sectionCount}`} />
        <MiniStat label="Previewblokken" value="10+" />
        <MiniStat label="Shells + nav" value="5+" />
        <MiniStat label="Mock data" value="Alleen preview" tone="muted" />
      </View>

      <View style={styles.grid}>
        <BlockCard
          title="Buttons"
          subtitle="Primair, secundair, icon en CTA"
          source="components/ui/finance-button.tsx"
        >
          <View style={styles.buttonStack}>
            <ComponentPreviewItem
              title="FinanceButton"
              copyValue="FinanceButton"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceButton"}
            >
              <View style={styles.buttonRow}>
                <FinanceButton label="Primary" />
                <FinanceButton label="Secondary" variant="secondary" />
                <FinanceButton label="Ghost" variant="ghost" />
                <FinanceButton label="Danger" variant="danger" />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceCircleIconButton"
              copyValue="FinanceCircleIconButton"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceCircleIconButton"}
            >
              <View style={styles.buttonRow}>
                <FinanceCircleIconButton
                  icon="add"
                  onPress={() => undefined}
                  accessibilityLabel="Voorbeeld icon knop"
                />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinancePrimaryCtaButton"
              copyValue="FinancePrimaryCtaButton"
              onCopy={handleCopy}
              copied={copiedKey === "FinancePrimaryCtaButton"}
            >
              <View style={styles.buttonRow}>
                <FinancePrimaryCtaButton
                  label="Nieuwe actie"
                  onPress={() => undefined}
                  showLeadingPlusIcon
                />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceStatusChip"
              copyValue="FinanceStatusChip"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceStatusChip"}
            >
              <View style={styles.chipRow}>
                <FinanceStatusChip label="Good" tone="good" />
                <FinanceStatusChip label="Watch" tone="watch" />
                <FinanceStatusChip label="Critical" tone="critical" />
              </View>
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Choice cards"
          subtitle="Keuze- en selectie-opbouw"
          source="components/ui/finance-category-sheet.tsx"
        >
          <View style={styles.choiceStack}>
            <ComponentPreviewItem
              title="FinanceFlatChoiceCard"
              copyValue="FinanceFlatChoiceCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceFlatChoiceCard"}
            >
              <FinanceFlatChoiceCard
                title="Huidige maand"
                description="Rustige flat choice card voor compacte selectie."
                rightSlot={<FinanceStatusChip label="Actief" tone="good" />}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceCategoryGroupCard + FinanceCategoryLeafRow"
              copyValue="FinanceCategoryGroupCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceCategoryGroupCard"}
            >
              <FinanceCategoryGroupCard
                title="Abonnementen"
                subtitle="Groepskeuze met leaf rows"
                selected
                expanded
                onToggle={() => undefined}
                iconName={"category" as AppIconName}
              >
                <FinanceCategoryLeafRow
                  label="Streaming"
                  selected
                  iconName={"receipt-long" as AppIconName}
                  onPress={() => undefined}
                />
                <FinanceCategoryLeafRow
                  label="Software"
                  selected={false}
                  iconName={"receipt-long" as AppIconName}
                  onPress={() => undefined}
                />
              </FinanceCategoryGroupCard>
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Rows"
          subtitle="Scanbare lijst- en settingsrijen"
          source="components/transactions/transaction-list-row.tsx + finance-settings-row.tsx"
        >
          <View style={styles.rowStack}>
            <ComponentPreviewItem
              title="FinanceSettingsRow"
              copyValue="FinanceSettingsRow"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceSettingsRow"}
            >
              <FinanceSettingsRow
                label="Design System"
                subtitle="Admin-only ingang"
                value="/admin/design-system"
                iconName={"tune" as AppIconName}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="TransactionListRow"
              copyValue="TransactionListRow"
              onCopy={handleCopy}
              copied={copiedKey === "TransactionListRow"}
            >
              <TransactionListRow
                title="AH - Bonuskaart"
                subtitle="Bood & drinken"
                meta="Voorbeeld van een echte transaction row"
                amount={-18.5}
                categoryById={mockCategoryById}
                categoryAutoId="cat_food"
                categoryUserId={null}
                onPress={() => undefined}
                showRunningBalance={false}
              />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Shells"
          subtitle="Topbar, hero en maandselector"
          source="components/ui/finance-top-bar.tsx + finance-hero-shell.tsx + finance-month-selector.tsx"
        >
          <View style={styles.shellStack}>
            <ComponentPreviewItem
              title="FinanceTopBar"
              copyValue="FinanceTopBar"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceTopBar"}
            >
              <FinanceTopBar
                title="Design System"
                subtitle="Admin reference"
                showMenu={false}
                rightSlot={
                  <View style={styles.topBarSlot}>
                    <FinanceText variant="caption" tone="muted">
                      UI blocks
                    </FinanceText>
                    <AppIcon name="view-module" size={18} color={FinColors.textSecondary} variant="outlined" />
                  </View>
                }
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceHeroShell"
              copyValue="FinanceHeroShell"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceHeroShell"}
            >
              <FinanceHeroShell
                eyebrow="Reference block"
                title="Handige shell-preview"
                subtitle="Dit laat de echte hero-opbouw zien zoals Budio die gebruikt."
              >
                <View style={styles.heroPreviewRow}>
                  <MiniStat label="Title" value="52 / 54" />
                  <MiniStat label="Offset" value="102px" />
                </View>
              </FinanceHeroShell>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceMonthSelector"
              copyValue="FinanceMonthSelector"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceMonthSelector"}
            >
              <FinanceMonthSelector
                label={monthLabel}
                canGoToOlderMonth
                canGoToNewerMonth
                onPressLabel={() => undefined}
                onGoToOlderMonth={() => undefined}
                onGoToNewerMonth={() => undefined}
              />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Topheader + quick-menu footer"
          subtitle="Hoofdscherm-navigatie en shell-infrastructuur"
          source="components/ui/finance-dashboard-header.tsx + components/navigation/finance-quick-menu.tsx"
        >
          <View style={styles.shellStack}>
            <ComponentPreviewItem
              title="FinanceDashboardHeader + FinanceHeaderActions"
              copyValue="FinanceDashboardHeader"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceDashboardHeader"}
            >
              <View style={styles.dashboardHeaderPreview}>
                <FinanceDashboardHeader
                  title="Dashboard"
                  rightSlot={<FinanceHeaderActions screenId="dashboard" />}
                />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceQuickMenu (docked footer)"
              copyValue="FinanceQuickMenu"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceQuickMenu"}
            >
              <View style={styles.quickMenuPreview}>
                <FinanceQuickMenu activeKey="index" onSelect={() => undefined} />
              </View>
            </ComponentPreviewItem>
            <ShellSource
              title="Gebruik"
              description="Topheader + docked quick-menu blijven gedeelde shellblokken. Niet per scherm opnieuw stylen."
            />
          </View>
        </BlockCard>

        <BlockCard
          title="Flow-bouwstenen"
          subtitle="Import en utility flows met echte gedeelde componenten"
          source="components/ui/finance-step-indicator.tsx + finance-detail-top-bar.tsx + finance-inline-callout.tsx"
        >
          <View style={styles.shellStack}>
            <ComponentPreviewItem
              title="FinanceStepIndicator"
              copyValue="FinanceStepIndicator"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceStepIndicator"}
            >
              <FinanceStepIndicator
                steps={IMPORT_FLOW_STEPS}
                currentStepKey="link-accounts"
                completedStepKeys={["choose-file"]}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceDetailTopBar"
              copyValue="FinanceDetailTopBar"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceDetailTopBar"}
            >
              <FinanceDetailTopBar
                title="Rekeningen koppelen"
                subtitle="Importflow stap 2"
                onBack={() => undefined}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceInlineCallout"
              copyValue="FinanceInlineCallout"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceInlineCallout"}
            >
              <View style={styles.stack}>
                <FinanceInlineCallout
                  iconName="info"
                  text="Gebruik dit voor korte contextregels binnen budget, import en insights."
                />
                <FinanceInlineCallout
                  iconName="warning"
                  tone="highlight"
                  text="Highlight alleen bij direct aandachtspunt met beslisimpact."
                />
              </View>
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Dashboard-blokken"
          subtitle="Balans, weeksturing en assistent-callout"
          source="components/dashboard/*"
        >
          <View style={styles.cardStack}>
            <ComponentPreviewItem
              title="DashboardBalanceSummary"
              copyValue="DashboardBalanceSummary"
              onCopy={handleCopy}
              copied={copiedKey === "DashboardBalanceSummary"}
            >
              <DashboardBalanceSummary
                surfaceBalances={null}
                activeMonthLabel={dashboardMonthLabel}
                remainingMonthlyBudget={742}
                hasTransactions
                scopeLabel="Persoonlijk"
                statusLabel="Je zit op schema voor maart 2026"
                safeToSpendUntilNextIncome={284}
                safeToSpendContextLabel="Veilig tot volgende inkomen"
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="DashboardBudgetOverviewCard"
              copyValue="DashboardBudgetOverviewCard"
              onCopy={handleCopy}
              copied={copiedKey === "DashboardBudgetOverviewCard"}
            >
              <DashboardBudgetOverviewCard
                model={buildDashboardBudgetOverviewModel(null, null, new Date("2026-03-15T12:00:00.000Z"))}
                onPress={() => undefined}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="DashboardAssistantCallout"
              copyValue="DashboardAssistantCallout"
              onCopy={handleCopy}
              copied={copiedKey === "DashboardAssistantCallout"}
            >
              <DashboardAssistantCallout />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Cards"
          subtitle="Detail, insight en helper"
          source="components/ui/finance-detail-card.tsx + finance-insight-card.tsx"
        >
          <View style={styles.cardStack}>
            <ComponentPreviewItem
              title="FinanceDetailCard"
              copyValue="FinanceDetailCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceDetailCard"}
            >
              <FinanceDetailCard
                title="Detail card"
                subtitle="Zachte informatiekaart met duidelijke hiërarchie"
              >
                <FinanceText variant="body-sm" tone="secondary">
                  Gebruik dit voor compacte samenvattingen en beheerblokken.
                </FinanceText>
              </FinanceDetailCard>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceDetailCard (warning)"
              copyValue="FinanceDetailCard-warning"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceDetailCard-warning"}
            >
              <FinanceDetailCard
                title="Warning tone"
                subtitle="Aandachtspunt"
                tone="warning"
              >
                <FinanceText variant="body-sm" tone="secondary">
                  Geeft een technisch of inhoudelijk aandachtspunt weer zonder zwaar te worden.
                </FinanceText>
              </FinanceDetailCard>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceInsightCard"
              copyValue="FinanceInsightCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceInsightCard"}
            >
              <FinanceInsightCard
                title="Insight card"
                description="Een echte helpercard voor uitleg, trend of aandacht."
                type="neutral"
                ctaLabel="Bekijk patroon"
                onPress={() => undefined}
              />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Budget-blokken"
          subtitle="Maand, week, druk en categorieprogressie"
          source="components/budget-*.tsx + components/risk-progress-bar.tsx"
        >
          <View style={styles.cardStack}>
            <ComponentPreviewItem
              title="BudgetMonthSummaryCard"
              copyValue="BudgetMonthSummaryCard"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetMonthSummaryCard"}
            >
              <BudgetMonthSummaryCard
                status="Op schema"
                remainingAmount={640}
                usedAmount={360}
                totalVariableAmount={1000}
                tone="good"
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetWeekRhythmCard"
              copyValue="BudgetWeekRhythmCard"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetWeekRhythmCard"}
            >
              <BudgetWeekRhythmCard
                periodLabel="11 - 17 mrt"
                status="Let op"
                remainingAmount={94}
                spentAmount={206}
                targetAmount={300}
                progress={0.69}
                tone="watch"
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetPressureList"
              copyValue="BudgetPressureList"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetPressureList"}
            >
              <BudgetPressureList
                items={[
                  {
                    id: "pressure-groceries",
                    title: "Boodschappen lopen op",
                    description: "Je zit boven je weekritme in deze categorie.",
                    severity: "watch",
                    icon: "receipt-long",
                  },
                  {
                    id: "pressure-subscription",
                    title: "Dubbel abonnement",
                    description: "Twee soortgelijke abonnementen zijn tegelijk actief.",
                    severity: "critical",
                    icon: "warning",
                  },
                ]}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetCategoryProgressRow"
              copyValue="BudgetCategoryProgressRow"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetCategoryProgressRow"}
            >
              <BudgetCategoryProgressRow
                label="Boodschappen"
                iconName="shopping-cart"
                utilization={0.72}
                actual={288}
                budget={400}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetAmountSlider"
              copyValue="BudgetAmountSlider"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetAmountSlider"}
            >
              <BudgetAmountSlider
                value={sliderValue}
                min={0}
                max={800}
                step={25}
                onChange={setSliderValue}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetMonthActionCard"
              copyValue="BudgetMonthActionCard"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetMonthActionCard"}
            >
              <BudgetMonthActionCard
                recommendation="Je zit op schema, maar boodschappen lopen iets op. Check Insights en stuur waar nodig bij."
                onOpenInsights={() => undefined}
                onOpenManage={() => undefined}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetManageIncomeSourcesGroup"
              copyValue="BudgetManageIncomeSourcesGroup"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetManageIncomeSourcesGroup"}
            >
              <BudgetManageIncomeSourcesGroup
                includedIncomeLabel="€ 2.840"
                monthBreakdownText="Maandopbouw: 4 weken, € 710 p.w. na aftrek van vaste lasten en reserveringen."
                rows={[
                  { key: "salary", label: "Salaris", enabled: true },
                  { key: "childBudget", label: "Kindgebonden budget", enabled: true },
                  { key: "variable", label: "Variabel", enabled: false },
                ]}
                onEdit={() => undefined}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetManageObligationsGroup"
              copyValue="BudgetManageObligationsGroup"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetManageObligationsGroup"}
            >
              <BudgetManageObligationsGroup
                totalLabel="€ 1.640"
                rows={[
                  { key: "fixed", label: "Vaste lasten", amountLabel: "€ 980" },
                  { key: "subs", label: "Abonnementen", amountLabel: "€ 120" },
                  { key: "reserve", label: "Reserves", amountLabel: "€ 540" },
                ]}
                onEdit={() => undefined}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BudgetManageDistributionGroup"
              copyValue="BudgetManageDistributionGroup"
              onCopy={handleCopy}
              copied={copiedKey === "BudgetManageDistributionGroup"}
            >
              <BudgetManageDistributionGroup
                rows={[
                  {
                    key: "groceries",
                    label: "Boodschappen",
                    amountLabel: "€ 420",
                    iconName: "shopping-basket" as AppIconName,
                  },
                  {
                    key: "fuel",
                    label: "Vervoer",
                    amountLabel: "€ 210",
                    iconName: "local-gas-station" as AppIconName,
                  },
                ]}
                onEdit={() => undefined}
              />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Insights-blokken"
          subtitle="Forecast, categoriecontext, momenten en scope"
          source="components/ui/finance-forecast-summary-card.tsx + finance-category-summary-card.tsx + finance-upcoming-moments-card.tsx"
        >
          <View style={styles.cardStack}>
            <ComponentPreviewItem
              title="FinanceScopeSwitch"
              copyValue="FinanceScopeSwitch"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceScopeSwitch"}
            >
              <FinanceScopeSwitch
                value={scopePreview}
                options={["personal", "shared", "household"]}
                onChange={(next) => setScopePreview(next as "personal" | "shared" | "household")}
              />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceForecastSummaryCard"
              copyValue="FinanceForecastSummaryCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceForecastSummaryCard"}
            >
              <FinanceForecastSummaryCard model={mockForecastCardModel} />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceCategorySummaryCard"
              copyValue="FinanceCategorySummaryCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceCategorySummaryCard"}
            >
              <FinanceCategorySummaryCard model={mockCategorySummaryModel} />
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceUpcomingMomentsCard"
              copyValue="FinanceUpcomingMomentsCard"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceUpcomingMomentsCard"}
            >
              <FinanceUpcomingMomentsCard items={mockUpcomingMoments} />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Forms"
          subtitle="Inputs en compacte selectie"
          source="components/ui/finance-input-field.tsx + finance-month-selector.tsx"
        >
          <View style={styles.formStack}>
            <ComponentPreviewItem
              title="FinanceInputField"
              copyValue="FinanceInputField"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceInputField"}
            >
              <View style={styles.formField}>
                <FinanceInputField
                  label="Rekeningnaam"
                  placeholder="Bijv. Gezamenlijke boodschappen"
                  value=""
                  onChangeText={() => undefined}
                  hint="Gebruik een naam die je direct herkent in budget en import."
                />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="TextInput (huidig patroon)"
              copyValue="TextInput-pattern"
              onCopy={handleCopy}
              copied={copiedKey === "TextInput-pattern"}
            >
              <View style={styles.formField}>
                <FinanceText variant="body-sm" weight="bold" tone="primary">
                  Naam
                </FinanceText>
                <TextInput
                  placeholder="Bijvoorbeeld: abonnement"
                  placeholderTextColor={FinColors.textMuted}
                  style={styles.input}
                />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="TextInput (zoek)"
              copyValue="TextInput-search-pattern"
              onCopy={handleCopy}
              copied={copiedKey === "TextInput-search-pattern"}
            >
              <View style={styles.formField}>
                <FinanceText variant="body-sm" weight="bold" tone="primary">
                  Zoekcomponent
                </FinanceText>
                <TextInput
                  placeholder="Zoek een patroon of token"
                  placeholderTextColor={FinColors.textMuted}
                  style={styles.input}
                />
              </View>
            </ComponentPreviewItem>
            <ShellSource
              title="Praktisch gebruik"
              description="Nieuwe of aangepakte flows gebruiken FinanceInputField als basis; legacy TextInput-varianten staan nog in oudere schermdelen."
            />
          </View>
        </BlockCard>

        <BlockCard
          title="Bankrekeningen"
          subtitle="Overzichtsrij en create/edit-sheet uit echte flow"
          source="components/bank-accounts/bank-account-overview-row.tsx + bank-account-form-sheet.tsx"
        >
          <View style={styles.cardStack}>
            <ComponentPreviewItem
              title="BankAccountOverviewRow"
              copyValue="BankAccountOverviewRow"
              onCopy={handleCopy}
              copied={copiedKey === "BankAccountOverviewRow"}
            >
              <View style={styles.listWrapPreview}>
                <BankAccountOverviewRow
                  account={mockBankAccount as never}
                  isLast
                  onEdit={() => undefined}
                  onDelete={() => undefined}
                />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="BankAccountFormSheet"
              copyValue="BankAccountFormSheet"
              onCopy={handleCopy}
              copied={copiedKey === "BankAccountFormSheet"}
            >
              <FinanceButton
                label="Open bankrekening modal"
                variant="secondary"
                onPress={() => setBankFormSheetOpen(true)}
              />
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Assistent Motion"
          subtitle="Bot icon + trigger motion voor assistent flows"
          source="components/motions/finance-assistant-motion-button.tsx + finance-assistant-motion-glyph.tsx"
        >
          <View style={styles.cardStack}>
            <ComponentPreviewItem
              title="FinanceAssistantMotionGlyph"
              copyValue="FinanceAssistantMotionGlyph"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceAssistantMotionGlyph"}
            >
              <View style={styles.motionPreviewWrap}>
                <FinanceAssistantMotionGlyph size={22} color={FinColors.textPrimary} />
              </View>
            </ComponentPreviewItem>
            <ComponentPreviewItem
              title="FinanceAssistantMotionButton"
              copyValue="FinanceAssistantMotionButton"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceAssistantMotionButton"}
            >
              <View style={styles.motionPreviewWrap}>
                <FinanceAssistantMotionButton onPress={() => undefined} />
              </View>
            </ComponentPreviewItem>
          </View>
        </BlockCard>

        <BlockCard
          title="Overlay"
          subtitle="De gedeelde sheet-shell"
          source="components/ui/finance-bottom-sheet-shell.tsx"
        >
          <View style={styles.sheetPreviewStack}>
            <ComponentPreviewItem
              title="FinanceBottomSheetShell"
              copyValue="FinanceBottomSheetShell"
              onCopy={handleCopy}
              copied={copiedKey === "FinanceBottomSheetShell"}
            >
              <FinanceButton label="Open sheet preview" onPress={() => setSheetOpen(true)} />
            </ComponentPreviewItem>
            <FinanceText variant="caption" tone="muted">
              Sheet, backdrop, handle, close en footer komen uit de gedeelde shell.
            </FinanceText>
          </View>
        </BlockCard>

        <BlockCard
          title="Flow-audit"
          subtitle="Import, bankrekeningen, hoofdmenu en budget beheer"
          source="services/design-system-hub.ts"
        >
          <View style={styles.familyStack}>
            {designSystemHubFlowCoverage.map((flow) => (
              <FinanceDetailCard
                key={`flow-audit-${flow.area}`}
                title={flow.area}
                subtitle={flow.shell}
                tone="subtle"
              >
                <View style={styles.stack}>
                  <FinanceText variant="caption" tone="muted" weight="bold">
                    Routes
                  </FinanceText>
                  <FinanceText variant="body-sm" tone="secondary">
                    {flow.routes.join(" · ")}
                  </FinanceText>
                  <FinanceText variant="caption" tone="muted" weight="bold">
                    Componentfocus
                  </FinanceText>
                  <View style={styles.familyChips}>
                    {flow.componentFocus.map((componentName) => (
                      <View key={`${flow.area}-${componentName}`} style={styles.familyChip}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleCopy(componentName)}
                          style={({ pressed }) => [styles.familyItemPressable, pressed && styles.copyButtonPressed]}
                        >
                          <FinanceText variant="caption" tone="secondary" weight="bold">
                            {componentName}
                          </FinanceText>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                  <FinanceText variant="caption" tone="muted">
                    Let op: {flow.attention}
                  </FinanceText>
                </View>
              </FinanceDetailCard>
            ))}
          </View>
        </BlockCard>

        <BlockCard
          title="Families"
          subtitle="Wat canoniek, in gebruik of legacy is"
          source="services/design-system-hub.ts"
        >
          <View style={styles.familyStack}>
            <View style={styles.familyExamplesRow}>
              <View style={styles.familyExampleCard}>
                <View style={styles.familyExampleHeader}>
                  <FinanceText variant="body-sm" weight="bold" tone="primary">
                    Voorbeeld: canoniek
                  </FinanceText>
                  <FinanceStatusChip label="canoniek" tone="good" />
                </View>
                <FinanceText variant="caption" tone="secondary">
                  Gedeelde basis die standaard gebruikt moet worden.
                </FinanceText>
              </View>
              <View style={styles.familyExampleCard}>
                <View style={styles.familyExampleHeader}>
                  <FinanceText variant="body-sm" weight="bold" tone="primary">
                    Voorbeeld: in gebruik
                  </FinanceText>
                  <FinanceStatusChip label="in gebruik" tone="watch" />
                </View>
                <FinanceText variant="caption" tone="secondary">
                  Actief gebruikt, maar nog niet altijd volledig gestandaardiseerd.
                </FinanceText>
              </View>
              <View style={styles.familyExampleCard}>
                <View style={styles.familyExampleHeader}>
                  <FinanceText variant="body-sm" weight="bold" tone="primary">
                    Voorbeeld: legacy
                  </FinanceText>
                  <FinanceStatusChip label="legacy" tone="critical" />
                </View>
                <FinanceText variant="caption" tone="secondary">
                  Bestaand patroon dat richting centralisatie of uitfasering moet.
                </FinanceText>
              </View>
            </View>
            {designSystemHubComponentFamilies.map((family) => (
              <View key={family.title} style={styles.familyCard}>
                <View style={styles.familyHeader}>
                  <View style={styles.familyHeaderText}>
                    <FinanceText variant="body-sm" weight="bold" tone="primary">
                      {family.title}
                    </FinanceText>
                    <View style={styles.familyStatusRow}>
                      <FinanceText variant="caption" tone="muted">
                        Status
                      </FinanceText>
                      <FinanceStatusChip
                        label={family.status}
                        tone={resolveFamilyStatusTone(family.status)}
                      />
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleCopy(family.title)}
                    style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
                  >
                    <FinanceText variant="caption" tone="secondary" weight="bold">
                      Kopieer familie
                    </FinanceText>
                  </Pressable>
                </View>
                <FinanceText variant="caption" tone="muted" weight="bold">
                  Gebruik
                </FinanceText>
                <FinanceText variant="body-sm" tone="secondary">
                  {family.usedIn}
                </FinanceText>
                <FinanceText variant="caption" tone="muted" weight="bold">
                  Bron
                </FinanceText>
                <FinanceText variant="body-sm" tone="secondary">
                  {family.source}
                </FinanceText>
                <FinanceText variant="caption" tone="muted" weight="bold">
                  Notitie
                </FinanceText>
                <FinanceText variant="body-sm" tone="secondary">
                  {family.note}
                </FinanceText>
                <View style={styles.familyChips}>
                  {family.items.map((item) => (
                    <View key={item} style={styles.familyChip}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => handleCopy(item)}
                        style={({ pressed }) => [styles.familyItemPressable, pressed && styles.copyButtonPressed]}
                      >
                        <FinanceText variant="caption" tone="secondary" weight="bold">
                          {item}
                        </FinanceText>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </BlockCard>
      </View>

      <FinanceSettingsGroup title="Quick links">
        {quickLinks.map((section) => (
          <FinanceSettingsRow
            key={section.id}
            label={section.label}
            subtitle={section.description}
            onPress={() => router.push(section.href as Href)}
          />
        ))}
      </FinanceSettingsGroup>

      <FinanceBottomSheetShell
        visible={sheetOpen}
        title="Sheet preview"
        subtitle="Gedeelde modal-shell met echte componenten"
        onClose={() => setSheetOpen(false)}
        footer={
          <FinanceButton
            label="Sluiten"
            onPress={() => setSheetOpen(false)}
            fullWidth
          />
        }
      >
        <View style={styles.sheetBody}>
          <FinanceDetailCard title="Wat deze shell regelt" tone="subtle">
            <FinanceText variant="body-sm" tone="secondary">
              Backdrop, sheet radius, handle, close-knop en footer horen bij de shell. De inhoud blijft compact.
            </FinanceText>
          </FinanceDetailCard>
          <FinanceSettingsRow label="Scroll" subtitle="Body scrollt" value="ja" />
          <FinanceSettingsRow label="Footer" subtitle="Blijft vast zichtbaar" value="ja" />
        </View>
      </FinanceBottomSheetShell>

      <BankAccountFormSheet
        visible={bankFormSheetOpen}
        mode="create"
        title="Nieuwe rekening"
        subtitle="Voeg een rekening toe en bepaal hoe die meetelt in je overzicht."
        showActiveToggle
        onClose={() => setBankFormSheetOpen(false)}
        onSaved={() => setBankFormSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
    alignItems: "center",
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  stack: {
    gap: FinSpacing.x2,
  },
  miniStat: {
    flexGrow: 1,
    minWidth: 160,
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: FinSpacing.m,
    gap: FinSpacing.x1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.l,
  },
  buttonStack: {
    gap: FinSpacing.m,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  choiceStack: {
    gap: FinSpacing.m,
  },
  rowStack: {
    gap: FinSpacing.m,
  },
  shellStack: {
    gap: FinSpacing.m,
  },
  previewItem: {
    gap: FinSpacing.s,
  },
  previewItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.x2,
  },
  copyButton: {
    borderRadius: FinRadius.pill,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  copyButtonPressed: {
    opacity: 0.86,
  },
  previewFrame: {
    borderRadius: FinRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgBase,
    padding: FinSpacing.l,
    minHeight: 92,
  },
  topBarSlot: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
  },
  heroPreviewRow: {
    flexDirection: "row",
    gap: FinSpacing.x2,
    flexWrap: "wrap",
  },
  dashboardHeaderPreview: {
    position: "relative",
    minHeight: 124,
    backgroundColor: FinColors.bgBase,
  },
  quickMenuPreview: {
    position: "relative",
    minHeight: 118,
    backgroundColor: FinColors.bgBase,
  },
  cardStack: {
    gap: FinSpacing.m,
  },
  formStack: {
    gap: FinSpacing.m,
  },
  formField: {
    gap: FinSpacing.x1,
  },
  listWrapPreview: {
    backgroundColor: FinColors.bgCard,
    borderRadius: FinRadius.xl,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    overflow: "hidden",
  },
  motionPreviewWrap: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    minHeight: 46,
    borderRadius: FinRadius.lg,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.m,
    paddingVertical: FinSpacing.s,
    color: FinColors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  sheetPreviewStack: {
    gap: FinSpacing.m,
  },
  sheetBody: {
    gap: FinSpacing.x2,
  },
  shellSource: {
    gap: 2,
    padding: FinSpacing.m,
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  familyStack: {
    gap: FinSpacing.m,
  },
  familyExamplesRow: {
    gap: FinSpacing.s,
  },
  familyExampleCard: {
    gap: FinSpacing.x1,
    padding: FinSpacing.m,
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  familyExampleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.x2,
  },
  familyCard: {
    gap: FinSpacing.s,
    padding: FinSpacing.m,
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  familyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: FinSpacing.x2,
  },
  familyHeaderText: {
    flex: 1,
    gap: FinSpacing.x1,
  },
  familyStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
  },
  familyChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  familyChip: {
    borderRadius: FinRadius.pill,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
    backgroundColor: FinColors.bgCard,
  },
  familyItemPressable: {
    borderRadius: FinRadius.pill,
  },
});
