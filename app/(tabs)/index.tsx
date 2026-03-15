import { RiskProgressBar } from "@/components/risk-progress-bar";
import { TransactionCategoryIcon } from "@/components/category-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import {
  getMonthVariableBudgetSnapshot,
  getWeekBudgetSnapshot,
  getWeekTempoMessage,
} from "@/services/budget-risk";
import { computeBudgetPlan } from "@/services/budget-plan";
import { getTransactionCategories } from "@/services/categorization-repository";
import { useCategorizationStatus } from "@/services/categorization-status";
import {
  buildCategoryRecordMap,
  getCategoryPathLabel,
} from "@/services/category-display";
import { requireCurrentUserId } from "@/services/current-user";
import { supabase } from "@/services/supabase";
import type { BudgetPlanComputation, CategoryRecord } from "@/types/categorization";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const fmt = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

type DashboardTx = {
  id: string;
  counterparty: string;
  date: string;
  amount: number;
  seq: number;
  runningBalance: number | null;
  category_id_auto: string | null;
  category_id_user: string | null;
};

type DashboardTxRow = DashboardTx & { categoryLabel: string };

function formatShortDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatWeekRangeLabel(startDate: string, endDateExclusive: string) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) {
    return `${formatShortDateLabel(startDate)} - ${formatShortDateLabel(endDateExclusive)}`;
  }

  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return `${formatShortDateLabel(startDate)} - ${formatShortDateLabel(endDate.toISOString().slice(0, 10))}`;
}

function formatRemainingDaysInWeekLabel(
  endDateExclusive: string,
  now = new Date(),
) {
  const endDate = new Date(`${endDateExclusive}T00:00:00.000Z`);
  if (Number.isNaN(endDate.getTime())) return null;

  const utcToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const dayDiff = Math.ceil(
    (endDate.getTime() - utcToday.getTime()) / (24 * 60 * 60 * 1000),
  );
  const remainingDays = Math.max(0, Math.min(7, dayDiff));
  const dayLabel = remainingDays === 1 ? "dag" : "dagen";
  return `${remainingDays} ${dayLabel} resterend`;
}

function getGreetingLabel(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Goedemorgen";
  if (hour < 18) return "Goedemiddag";
  return "Goedenavond";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatDeltaLabel(value: number | null) {
  if (value == null) return null;
  if (value === 0) return "Geen verandering sinds gisteren";
  return `${value > 0 ? "+" : "-"}${fmt.format(Math.abs(value))} sinds gisteren`;
}

function isMissingRelationError(error: unknown) {
  const code = String((error as { code?: string })?.code || "");
  const message = String(
    (error as { message?: string })?.message || "",
  ).toLowerCase();

  if (code === "42P01" || code === "PGRST205") return true;
  return message.includes("relation") && message.includes("does not exist");
}

function buildPositiveNudges({
  remainingBudget,
  week,
  streak,
}: {
  remainingBudget: number | null;
  week: BudgetWeekPlanRow | null;
  streak: number;
}) {
  const items: string[] = [];

  if (week?.remaining != null && week.remaining > 0) {
    items.push(`Je houdt waarschijnlijk ${fmt.format(week.remaining)} over deze week`);
  }

  if (remainingBudget != null && remainingBudget > 0) {
    items.push(`${fmt.format(remainingBudget)} maandruimte staat nog open`);
  }

  if (streak >= 2) {
    items.push(`${streak} weken op rij onder budget`);
  }

  if (week && week.actual === 0) {
    items.push("Rustige start van de week");
  }

  return items.slice(0, 3);
}

function TxRow({
  tx,
  categoryMap,
}: {
  tx: DashboardTxRow;
  categoryMap: Map<string, CategoryRecord>;
}) {
  const isPositive = tx.amount >= 0;

  return (
    <View style={styles.txRow}>
      <View style={styles.txIconWrap}>
        <TransactionCategoryIcon row={tx} categoryById={categoryMap} />
      </View>
      <View style={styles.txMid}>
        <Text style={styles.txName} numberOfLines={1}>
          {tx.counterparty || "Onbekend"}
        </Text>
        <View style={styles.txMetaRow}>
          <Text style={styles.txSub} numberOfLines={1}>
            {formatShortDateLabel(tx.date)}
          </Text>
          <Text style={styles.txCategory}>{tx.categoryLabel}</Text>
        </View>
      </View>
      <Text style={[styles.txAmount, isPositive && styles.txAmountPos]}>
        {isPositive ? "+" : ""}
        {fmt.format(tx.amount)}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const [transactions, setTransactions] = React.useState<DashboardTx[]>([]);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [budgetPlan, setBudgetPlan] =
    React.useState<BudgetPlanComputation | null>(null);
  const [budgetSchemaMissing, setBudgetSchemaMissing] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [balanceDelta, setBalanceDelta] = React.useState<number | null>(null);
  const budgetLoadInFlight = React.useRef(false);
  const isFocused = useIsFocused();
  const backgroundStatus = useCategorizationStatus();

  const categoryMap = React.useMemo(
    () => buildCategoryRecordMap(categories),
    [categories],
  );

  const hasTransactions = transactions.length > 0;

  const recentTransactions = React.useMemo<DashboardTxRow[]>(
    () =>
      transactions.map((tx) => ({
        ...tx,
        categoryLabel: getCategoryPathLabel(tx, categoryMap),
      })),
    [transactions, categoryMap],
  );

  const remainingBudget = React.useMemo(() => {
    return getMonthVariableBudgetSnapshot(budgetPlan).remaining;
  }, [budgetPlan]);
  const monthBudgetSnapshot = React.useMemo(
    () => getMonthVariableBudgetSnapshot(budgetPlan),
    [budgetPlan],
  );
  const monthSpentInBudget = monthBudgetSnapshot.spent;

  const currentWeekPlan = React.useMemo(() => {
    if (!budgetPlan) return null;
    return (
      budgetPlan.weeklyVariablePlan.find((week) => week.isCurrentWeek) || null
    );
  }, [budgetPlan]);

  const currentWeekRemainingDays = React.useMemo(() => {
    if (!currentWeekPlan) return null;
    return formatRemainingDaysInWeekLabel(currentWeekPlan.endDateExclusive);
  }, [currentWeekPlan]);

  const currentWeekProgress = React.useMemo(() => {
    return getWeekBudgetSnapshot(currentWeekPlan).progress;
  }, [currentWeekPlan]);
  const currentWeekSnapshot = React.useMemo(
    () => getWeekBudgetSnapshot(currentWeekPlan),
    [currentWeekPlan],
  );
  const currentWeekRiskTone = currentWeekSnapshot.tone;
  const monthRiskTone = monthBudgetSnapshot.tone;

  const underBudgetStreak = React.useMemo(() => {
    if (!budgetPlan) return 0;

    const completedWeeks = [...budgetPlan.weeklyVariablePlan]
      .filter((week) => week.isPastWeek)
      .sort((left, right) =>
        left.endDateExclusive < right.endDateExclusive ? 1 : -1,
      );

    let streak = 0;
    for (const week of completedWeeks) {
      if (week.actual <= week.budget) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  }, [budgetPlan]);

  const positiveNudges = React.useMemo(
    () =>
      buildPositiveNudges({
        remainingBudget,
        week: currentWeekPlan,
        streak: underBudgetStreak,
      }),
    [currentWeekPlan, remainingBudget, underBudgetStreak],
  );
  const weeklyTrendBars = React.useMemo(() => {
    if (!budgetPlan) return [];

    return budgetPlan.weeklyVariablePlan.slice(0, 4).map((week) => ({
      key: week.endDateExclusive,
      label: week.label,
      utilization: clamp(week.utilization, 0, 1.25),
      isCurrentWeek: week.isCurrentWeek,
    }));
  }, [budgetPlan]);

  const loadCategories = React.useCallback(async () => {
    try {
      const rows = await getTransactionCategories();
      setCategories(rows);
    } catch (error) {
      console.error("[dashboard] categories error", error);
    }
  }, []);

  const loadDashboard = React.useCallback(async () => {
    try {
      const userId = await requireCurrentUserId();
      const { data } = await supabase
        .from("transactions")
        .select(
          "id,counterparty,date,amount,metadata,category_id_auto,category_id_user",
        )
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .order("metadata->>Volgnr", { ascending: false })
        .limit(50);

      if (!data) return;

      const rows: DashboardTx[] = data.map((row: any) => {
        const metadata = row.metadata || {};
        const rawSeq = String(metadata["Volgnr"] || "").replace(/^0+/, "");
        const rawBalance = metadata["Saldo na trn"];

        let runningBalance: number | null = null;
        if (rawBalance != null) {
          const parsed = parseFloat(
            String(rawBalance).replace(/\./g, "").replace(",", "."),
          );
          runningBalance = Number.isNaN(parsed) ? null : parsed;
        }

        return {
          id: row.id,
          counterparty: String(row.counterparty || "").trim(),
          date: row.date,
          amount: row.amount,
          seq: Number.parseInt(rawSeq || "0", 10) || 0,
          runningBalance,
          category_id_auto: row.category_id_auto || null,
          category_id_user: row.category_id_user || null,
        };
      });

      rows.sort((left, right) =>
        left.date === right.date
          ? right.seq - left.seq
          : left.date < right.date
            ? 1
            : -1,
      );

      if (!rows.length) {
        setTransactions([]);
        setBalance(null);
        setBalanceDelta(null);
        return;
      }

      setTransactions(rows.slice(0, 3));

      const balanceRows = rows.filter((row) => row.runningBalance != null);
      const latestBalance = balanceRows[0]?.runningBalance ?? null;
      const previousBalance = balanceRows[1]?.runningBalance ?? null;

      setBalance(latestBalance);
      setBalanceDelta(
        latestBalance != null && previousBalance != null
          ? latestBalance - previousBalance
          : null,
      );
    } catch (error) {
      console.error("[dashboard] load error", error);
    }
  }, []);

  const loadBudget = React.useCallback(async () => {
    if (budgetSchemaMissing) {
      setBudgetPlan(null);
      return;
    }
    if (budgetLoadInFlight.current) return;

    budgetLoadInFlight.current = true;
    try {
      const plan = await computeBudgetPlan(new Date(), "default");
      setBudgetPlan(plan);
    } catch (error) {
      if (isMissingRelationError(error)) {
        setBudgetSchemaMissing(true);
        setBudgetPlan(null);
        return;
      }

      console.error("[dashboard] budget load error", error);
      setBudgetPlan(null);
    } finally {
      budgetLoadInFlight.current = false;
    }
  }, [budgetSchemaMissing]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadCategories();
  }, [isFocused, loadCategories]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadDashboard();
    void loadBudget();
  }, [isFocused, loadBudget, loadDashboard]);

  React.useEffect(() => {
    if (!isFocused || !backgroundStatus.lastCompletedAt) return;
    void loadCategories();
    void loadDashboard();
    void loadBudget();
  }, [
    backgroundStatus.lastCompletedAt,
    isFocused,
    loadBudget,
    loadCategories,
    loadDashboard,
  ]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <HeaderDropdownMenu />
          <View>
            <Text style={styles.greeting}>{getGreetingLabel()}</Text>
            <Text style={styles.headerTitle}>Je geld vandaag</Text>
          </View>
        </View>
        <View style={styles.headerBadge}>
          <MaterialIcons
            name="notifications-none"
            size={18}
            color={FinColors.textPrimary}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>Rekeningstand</Text>
          <Text style={[styles.heroAmount, !hasTransactions && styles.emptyAmount]}>
            {hasTransactions && balance != null ? fmt.format(balance) : "Nog geen data"}
          </Text>
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMeta}>
              {hasTransactions
                ? formatDeltaLabel(balanceDelta) || "Saldo is bijgewerkt"
                : "Importeer transacties om je stand te tonen"}
            </Text>
            {hasTransactions ? (
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>Nu</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.heroSupport}>
            {hasTransactions
              ? "Actuele momentopname van je hoofdrekening."
              : "Koppel of importeer transacties om direct overzicht te krijgen."}
          </Text>
        </View>

        <Pressable style={styles.primaryCard} onPress={() => router.push("/budget")}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.eyebrow}>Nog vrij te besteden</Text>
              <Text style={styles.primaryValue}>
                {remainingBudget == null
                  ? "Nog geen data"
                  : fmt.format(Math.max(remainingBudget, 0))}
              </Text>
            </View>
            <View style={styles.inlineCta}>
              <Text style={styles.inlineCtaText}>Bekijk budget</Text>
              <MaterialIcons
                name="chevron-right"
                size={16}
                color={FinColors.warningText}
              />
            </View>
          </View>
          <Text style={styles.primarySupport}>
            {budgetPlan
              ? monthBudgetSnapshot.state === "no_budget"
                ? "Stel eerst een variabel budget in om vrije ruimte te zien."
                : monthBudgetSnapshot.state === "over_budget"
                  ? `${fmt.format(Math.abs(monthBudgetSnapshot.remaining || 0))} boven je variabele maandbudget van ${fmt.format(monthBudgetSnapshot.budget || 0)}`
                  : `${fmt.format(monthBudgetSnapshot.spent || 0)} van ${fmt.format(monthBudgetSnapshot.budget || 0)} variabel gebruikt`
              : budgetSchemaMissing
                ? "Budgetschema is nog niet beschikbaar in deze omgeving."
                : "Budgetgegevens laden..."}
          </Text>
          {budgetPlan ? (
            <View style={styles.subStatsRow}>
              <View style={styles.subStatCard}>
                <Text style={styles.subStatLabel}>Variabel gebruikt</Text>
                <Text style={styles.subStatValue}>
                  {monthSpentInBudget == null
                    ? "Onbekend"
                    : fmt.format(monthSpentInBudget)}
                </Text>
              </View>
              <View style={styles.subStatCard}>
                <Text style={styles.subStatLabel}>Status</Text>
                <Text
                    style={[
                      styles.subStatValue,
                    monthRiskTone === "good" &&
                      styles.positiveText,
                    monthRiskTone === "watch" &&
                      styles.warningText,
                    monthRiskTone === "critical" &&
                      styles.negativeText,
                    ]}
                  >
                  {monthBudgetSnapshot.label}
                </Text>
              </View>
            </View>
          ) : null}
        </Pressable>

        <Pressable style={styles.secondaryCard} onPress={() => router.push("/budget")}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeaderText}>
              <Text style={styles.sectionTitle}>Deze week</Text>
              <Text style={styles.sectionSubtle}>
                {currentWeekPlan
                  ? formatWeekRangeLabel(
                      currentWeekPlan.startDate,
                      currentWeekPlan.endDateExclusive,
                    )
                  : "Weekbudget volgt zodra je budget actief is"}
              </Text>
            </View>
            <View
              style={[
                styles.statusChip,
                currentWeekRiskTone === "good" &&
                  styles.statusChipGood,
                currentWeekRiskTone === "watch" &&
                  styles.statusChipWatch,
                currentWeekRiskTone === "critical" &&
                  styles.statusChipCritical,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  currentWeekRiskTone === "good" &&
                    styles.statusChipTextGood,
                  currentWeekRiskTone === "watch" &&
                    styles.statusChipTextWatch,
                  currentWeekRiskTone === "critical" &&
                    styles.statusChipTextCritical,
                ]}
              >
                {currentWeekSnapshot.label}
              </Text>
            </View>
          </View>
          <View style={styles.weekSummaryRow}>
            <Text style={styles.weekSummaryValue}>
              {currentWeekPlan
                ? `${fmt.format(currentWeekPlan.actual)} van ${fmt.format(currentWeekPlan.budget)}`
                : "Nog geen weekbudget"}
            </Text>
            <Text style={styles.weekSummaryMeta}>
              {currentWeekRemainingDays || "Deze week"}
            </Text>
          </View>
          <RiskProgressBar
            progress={currentWeekProgress}
            tone={currentWeekRiskTone}
            style={styles.progressTrack}
          />
          {weeklyTrendBars.length ? (
            <View style={styles.sparklineRow}>
              {weeklyTrendBars.map((bar) => (
                <View key={bar.key} style={styles.sparklineItem}>
                  <View style={styles.sparklineTrack}>
                    <View
                      style={[
                        styles.sparklineFill,
                        {
                          height: `${Math.round(bar.utilization * 100)}%`,
                        },
                        bar.isCurrentWeek && styles.sparklineFillCurrent,
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.sparklineLabel,
                      bar.isCurrentWeek && styles.sparklineLabelCurrent,
                    ]}
                  >
                    {bar.label.replace("Week ", "W")}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.weekTrendText}>
            {getWeekTempoMessage(currentWeekPlan)}
          </Text>
        </Pressable>

        <View style={styles.nudgeCard}>
          <View style={styles.nudgeHeader}>
            <Text style={styles.sectionTitle}>Positieve signalen</Text>
            <MaterialIcons name="wb-sunny" size={16} color={FinColors.warningText} />
          </View>
          {positiveNudges.length ? (
            positiveNudges.map((item) => (
              <View key={item} style={styles.nudgeRow}>
                <View style={styles.nudgeDot} />
                <Text style={styles.nudgeText}>{item}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.nudgeFallback}>
              Zodra er wat meer ritme in je transacties zit, laten we hier je
              positieve voortgang zien.
            </Text>
          )}
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={() => router.push("/transactions")}
          >
            <Text style={styles.actionButtonPrimaryText}>Transacties bekijken</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/csv-import")}
          >
            <Text style={styles.actionButtonText}>Importeren</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Laatste transacties</Text>
          <TouchableOpacity onPress={() => router.push("/transactions")}>
            <Text style={styles.seeAll}>Open lijst</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.txCard}>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>Nog geen transacties</Text>
          ) : (
            recentTransactions.map((tx, index) => (
              <React.Fragment key={tx.id}>
                <TxRow tx={tx} categoryMap={categoryMap} />
                {index < recentTransactions.length - 1 ? (
                  <View style={styles.divider} />
                ) : null}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  greeting: {
    fontSize: 12,
    color: FinColors.textSecondary,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 16,
  },
  heroCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  eyebrow: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroAmount: {
    fontSize: 38,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -1.1,
  },
  emptyAmount: {
    fontSize: 18,
    color: FinColors.textMuted,
    letterSpacing: 0,
  },
  heroMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    gap: 10,
  },
  heroMeta: {
    flex: 1,
    fontSize: 14,
    color: FinColors.textSecondary,
    fontWeight: "600",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
  },
  liveText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  heroSupport: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
    marginTop: 12,
  },
  primaryCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  primaryValue: {
    fontSize: 30,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.8,
  },
  inlineCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
  },
  inlineCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  primarySupport: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  subStatsRow: {
    flexDirection: "row",
    gap: 10,
  },
  subStatCard: {
    flex: 1,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  subStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  subStatValue: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  positiveText: {
    color: FinColors.green,
  },
  warningText: {
    color: FinColors.warningText,
  },
  negativeText: {
    color: FinColors.red,
  },
  secondaryCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: -2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  sectionSubtle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  statusChipGood: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  statusChipWatch: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  statusChipCritical: {
    backgroundColor: FinColors.redBg,
    borderColor: "rgba(197,93,76,0.18)",
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  statusChipTextGood: {
    color: FinColors.green,
  },
  statusChipTextWatch: {
    color: FinColors.warningText,
  },
  statusChipTextCritical: {
    color: FinColors.red,
  },
  weekSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekSummaryValue: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  weekSummaryMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: FinColors.textSecondary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
  },
  weekTrendText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  sparklineRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    minHeight: 64,
  },
  sparklineItem: {
    alignItems: "center",
    gap: 6,
  },
  sparklineTrack: {
    width: 16,
    height: 46,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  sparklineFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.14)",
    minHeight: 6,
  },
  sparklineFillCurrent: {
    backgroundColor: FinColors.yellow,
  },
  sparklineLabel: {
    fontSize: 11,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  sparklineLabelCurrent: {
    color: FinColors.textPrimary,
  },
  nudgeCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 12,
  },
  nudgeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nudgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nudgeDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
  },
  nudgeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  nudgeFallback: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonPrimary: {
    backgroundColor: FinColors.textPrimary,
    borderColor: FinColors.textPrimary,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  actionButtonPrimaryText: {
    fontSize: 14,
    fontWeight: "700",
    color: FinColors.bgCard,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  txCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    padding: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  txIconWrap: {
    marginRight: 14,
  },
  txMid: {
    flex: 1,
  },
  txName: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  txMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
    flexWrap: "wrap",
  },
  txSub: {
    fontSize: 12,
    color: FinColors.textMuted,
  },
  txCategory: {
    fontSize: 11,
    color: FinColors.textPrimary,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
  },
  txAmount: {
    fontSize: 15,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  txAmountPos: {
    color: FinColors.green,
  },
  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 68,
  },
  emptyText: {
    fontSize: 14,
    color: FinColors.textMuted,
    textAlign: "center",
    paddingVertical: 24,
  },
});
