import { TransactionCategoryIcon } from "@/components/category-icon";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { getBudgetGroupLabel } from "@/services/category-budget-groups";
import { recategorizeSingleTransaction } from "@/services/categorization";
import {
    bulkUpdateCategoryByCounterparty,
    countCounterpartyTransactions,
    getCounterpartyTransactions,
    getTransactionCategories,
    getTransactionDetail,
    setTransactionBudgetExcluded,
    setTransactionManualCategory,
    type CounterpartyTxSummary,
    type TransactionDetail,
} from "@/services/categorization-repository";
import {
    getCategoryPathLabel,
    getLeafCategories,
} from "@/services/category-display";
import { resolveIncomeSemanticsForTransaction } from "@/services/income-semantics";
import {
    getTransactionSubscriptionMatch,
    linkTransactionToSubscription,
    listTransactionSubscriptionProfileNames,
    listSubscriptionProfiles,
    markTransactionAsNotSubscription,
    type TransactionSubscriptionMatchWithProfile,
} from "@/services/subscriptions";
import type {
    CategoryRecord,
    SubscriptionProfile,
    SubscriptionProviderHint,
} from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function truncateMsg(s: string, max: number) {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

const SUBJECT_DRIVEN_PROVIDERS = [
  "klarna",
  "paypal",
  "riverty",
  "afterpay",
  "billink",
  "in3",
  "sprinque",
];

function isSubjectDrivenCounterparty(counterparty: string | null | undefined) {
  const normalized = String(counterparty || "").toLowerCase();
  if (!normalized) return false;
  return SUBJECT_DRIVEN_PROVIDERS.some((token) => normalized.includes(token));
}

function getSubjectFromDetails(details: string) {
  return details.split("|")[0]?.trim() || details;
}

function detectProviderHintFromTransaction(
  counterparty: string | null,
  details: string,
): SubscriptionProviderHint | null {
  const haystack = normalizeSubscriptionText(
    `${counterparty || ""} ${details || ""}`,
  );
  if (!haystack) return null;

  if (haystack.includes("paypal")) return "paypal";
  if (haystack.includes("google play") || haystack.includes("googleplay")) {
    return "google_play";
  }
  if (
    haystack.includes("apple") ||
    haystack.includes("itunes") ||
    haystack.includes("apple com bill")
  ) {
    return "apple";
  }
  if (
    haystack.includes("klarna") ||
    haystack.includes("riverty") ||
    haystack.includes("afterpay") ||
    haystack.includes("billink") ||
    haystack.includes("in3")
  ) {
    return "klarna";
  }
  return null;
}

const PSP_HINTS = [
  "paypal",
  "google play",
  "google*play",
  "apple",
  "itunes",
  "klarna",
  "riverty",
  "afterpay",
  "billink",
  "in3",
  "sprinque",
];

function normalizeSubscriptionText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelySubscriptionPspTransaction(
  counterparty: string | null,
  details: string,
) {
  const haystack = normalizeSubscriptionText(
    `${counterparty || ""} ${details || ""}`,
  );
  if (!haystack) return false;
  return PSP_HINTS.some((hint) =>
    haystack.includes(normalizeSubscriptionText(hint)),
  );
}

type AiSuggestion = {
  categoryId: string;
  categoryKey: string;
  categoryName: string;
  parentName: string | null;
  confidence: number;
  reason: string;
  isSameAsCurrent: boolean;
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function TransactionDetailScreen() {
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const transactionId = React.useMemo(
    () => normalizeRouteParam(params.id),
    [params.id],
  );
  const router = useRouter();

  const [tx, setTx] = React.useState<TransactionDetail | null>(null);
  const [categories, setCategories] = React.useState<CategoryRecord[]>([]);
  const [history, setHistory] = React.useState<
    (CounterpartyTxSummary & { subscriptionProfileName?: string | null })[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [showPicker, setShowPicker] = React.useState(false);
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [aiState, setAiState] = React.useState<
    "idle" | "loading" | "result" | "error"
  >("idle");
  const [aiSuggestion, setAiSuggestion] = React.useState<AiSuggestion | null>(
    null,
  );
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [bulkPhase, setBulkPhase] = React.useState<
    "idle" | "confirming" | "updating" | "done"
  >("idle");
  const [bulkScope, setBulkScope] = React.useState<"uncategorized" | "all">(
    "uncategorized",
  );
  const [bulkCounts, setBulkCounts] = React.useState<{
    uncategorized: number;
    all: number;
  } | null>(null);
  const [budgetExclusionToggling, setBudgetExclusionToggling] =
    React.useState(false);
  const [subscriptionProfiles, setSubscriptionProfiles] = React.useState<
    SubscriptionProfile[]
  >([]);
  const [subscriptionMatch, setSubscriptionMatch] =
    React.useState<TransactionSubscriptionMatchWithProfile | null>(null);
  const [subscriptionModalOpen, setSubscriptionModalOpen] =
    React.useState(false);
  const [subscriptionActionBusy, setSubscriptionActionBusy] =
    React.useState(false);
  const [setCategoryToSubscriptions, setSetCategoryToSubscriptions] =
    React.useState(true);
  const [detailsExpanded, setDetailsExpanded] = React.useState(false);

  // ── Derived maps ───────────────────────────────────────────────────────
  const categoryById = React.useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const leafCategories = React.useMemo(
    () => getLeafCategories(categories, { curatedOnly: true }),
    [categories],
  );

  const categoryGroups = React.useMemo(() => {
    const groups = new Map<string | null, CategoryRecord[]>();
    for (const cat of leafCategories) {
      const pid = cat.parent_id || null;
      if (!groups.has(pid)) groups.set(pid, []);
      groups.get(pid)!.push(cat);
    }
    return Array.from(groups.entries())
      .map(([pid, leaves]) => ({
        parent: pid ? categoryById.get(pid) || null : null,
        leaves,
      }))
      .sort((a, b) =>
        (a.parent?.name ?? "\uFFFF").localeCompare(
          b.parent?.name ?? "\uFFFF",
          "nl",
        ),
      );
  }, [leafCategories, categoryById]);

  const effectiveCategoryId =
    tx?.category_id_user || tx?.category_id_auto || null;
  const effectiveCategory = effectiveCategoryId
    ? categoryById.get(effectiveCategoryId) || null
    : null;
  const parentCategory = effectiveCategory?.parent_id
    ? categoryById.get(effectiveCategory.parent_id) || null
    : null;
  const budgetGroupLabel = getBudgetGroupLabel(effectiveCategory?.budget_group);
  const incomeSemantics = React.useMemo(
    () =>
      tx
        ? resolveIncomeSemanticsForTransaction(tx, categoryById)
        : null,
    [categoryById, tx],
  );
  const incomeSemanticLabel =
    tx && tx.amount > 0 ? incomeSemantics?.shortLabel || null : null;
  const isSubjectDrivenProvider = React.useMemo(
    () => isSubjectDrivenCounterparty(tx?.counterparty),
    [tx?.counterparty],
  );
  const activeSubscriptionProfiles = React.useMemo(
    () => subscriptionProfiles.filter((profile) => profile.isActive),
    [subscriptionProfiles],
  );
  const linkedSubscriptionProfile = subscriptionMatch?.profile || null;
  const isPspLikeExpense = React.useMemo(() => {
    if (!tx) return false;
    if (tx.amount >= 0) return false;
    return isLikelySubscriptionPspTransaction(tx.counterparty, tx.details);
  }, [tx]);
  const subscriptionStatusLabel = linkedSubscriptionProfile
    ? "Abonnement gekoppeld"
    : isPspLikeExpense
      ? "PSP-betaling"
      : null;

  // ── Data loading ────────────────────────────────────────────────────────
  const loadData = React.useCallback(async () => {
    if (!transactionId) {
      setTx(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [detail, cats, profiles, match] = await Promise.all([
        getTransactionDetail(transactionId),
        getTransactionCategories(),
        listSubscriptionProfiles(),
        getTransactionSubscriptionMatch(transactionId),
      ]);
      setTx(detail);
      setCategories(cats);
      setSubscriptionProfiles(profiles);
      setSubscriptionMatch(match);
      if (detail?.counterparty) {
        const hist = await getCounterpartyTransactions(
          detail.counterparty,
          transactionId,
          5,
        );
        const subscriptionNames = await listTransactionSubscriptionProfileNames(
          hist.map((item) => item.id),
        );
        setHistory(
          hist.map((item) => ({
            ...item,
            subscriptionProfileName: subscriptionNames[item.id] || null,
          })),
        );
      }
    } catch (e) {
      console.warn("transaction-detail load error", e);
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadData();
  }, [isFocused, loadData]);

  // ── Manual category ─────────────────────────────────────────────────────
  const handleManualCategory = React.useCallback(
    async (categoryId: string) => {
      if (!transactionId) return;
      setSavingCategory(true);
      try {
        await setTransactionManualCategory(transactionId, categoryId, {
          reason: "handmatige wijziging",
          learnFromCounterparty: !isSubjectDrivenCounterparty(tx?.counterparty),
        });
        setShowPicker(false);
        const detail = await getTransactionDetail(transactionId);
        setTx(detail);
      } catch (e) {
        console.warn("setCategory error", e);
      } finally {
        setSavingCategory(false);
      }
    },
    [transactionId, tx?.counterparty],
  );

  // ── AI reclassification ─────────────────────────────────────────────────
  const handleAiReclassify = React.useCallback(async () => {
    if (!transactionId || !tx) return;
    setAiState("loading");
    setAiSuggestion(null);
    setAiError(null);
    setShowPicker(false);
    try {
      const result = await recategorizeSingleTransaction(transactionId);
      if (!result) {
        setAiError("Geen resultaat ontvangen van AI.");
        setAiState("error");
        return;
      }
      const resultCat = categoryById.get(result.categoryId);
      const parent = resultCat?.parent_id
        ? categoryById.get(resultCat.parent_id) || null
        : null;
      const isSameAsCurrent =
        result.categoryId === (tx.category_id_user || tx.category_id_auto);
      setAiSuggestion({
        ...result,
        parentName: parent?.name ?? null,
        isSameAsCurrent,
      });
      setAiState("result");
    } catch (e) {
      setAiError(truncateMsg(e instanceof Error ? e.message : String(e), 200));
      setAiState("error");
    }
  }, [transactionId, tx, categoryById]);

  const handleApplyAi = React.useCallback(
    async (learnRule: boolean) => {
      if (!transactionId || !aiSuggestion) return;
      setSavingCategory(true);
      try {
        await setTransactionManualCategory(
          transactionId,
          aiSuggestion.categoryId,
          {
            reason: "AI herclassificatie",
            learnFromCounterparty:
              learnRule && !isSubjectDrivenCounterparty(tx?.counterparty),
          },
        );
        const detail = await getTransactionDetail(transactionId);
        setTx(detail);
        setAiState("idle");
        setAiSuggestion(null);

        if (
          detail?.counterparty &&
          !isSubjectDrivenCounterparty(detail.counterparty)
        ) {
          const [uncatCount, allCount] = await Promise.all([
            countCounterpartyTransactions(detail.counterparty, "uncategorized"),
            countCounterpartyTransactions(detail.counterparty, "all"),
          ]);
          setBulkCounts({ uncategorized: uncatCount, all: allCount });
          setBulkPhase("confirming");
        } else {
          setBulkPhase("idle");
        }
      } catch (e) {
        console.warn("apply AI error", e);
      } finally {
        setSavingCategory(false);
      }
    },
    [transactionId, aiSuggestion, tx?.counterparty],
  );

  // ── Bulk update ─────────────────────────────────────────────────────────
  const handleBulkUpdate = React.useCallback(async () => {
    if (!tx?.counterparty || !tx?.category_id_user || !transactionId) return;
    setBulkPhase("updating");
    try {
      await bulkUpdateCategoryByCounterparty(
        tx.counterparty,
        tx.category_id_user,
        bulkScope,
      );
      const hist = await getCounterpartyTransactions(
        tx.counterparty,
        transactionId,
        5,
      );
      const subscriptionNames = await listTransactionSubscriptionProfileNames(
        hist.map((item) => item.id),
      );
      setHistory(
        hist.map((item) => ({
          ...item,
          subscriptionProfileName: subscriptionNames[item.id] || null,
        })),
      );
      setBulkPhase("done");
    } catch (e) {
      console.warn("bulk update error", e);
      setBulkPhase("confirming");
    }
  }, [tx, transactionId, bulkScope]);

  // ── Reviewed toggle ─────────────────────────────────────────────────────
  const handleBudgetExcludedToggle = React.useCallback(
    async (value: boolean) => {
      if (!transactionId || budgetExclusionToggling) return;
      setBudgetExclusionToggling(true);
      setTx((prev) => (prev ? { ...prev, budget_excluded: value } : prev));
      try {
        await setTransactionBudgetExcluded(transactionId, value);
      } catch (e) {
        setTx((prev) => (prev ? { ...prev, budget_excluded: !value } : prev));
        console.warn("budget excluded toggle error", e);
      } finally {
        setBudgetExclusionToggling(false);
      }
    },
    [budgetExclusionToggling, transactionId],
  );

  const handleLinkToSubscription = React.useCallback(
    async (profileId: string) => {
      if (!transactionId || subscriptionActionBusy) return;
      setSubscriptionActionBusy(true);
      try {
        await linkTransactionToSubscription({
          transactionId,
          subscriptionProfileId: profileId,
          notes: "gekoppeld vanuit transactie-detail",
          confidence: 1,
          setCategoryToSubscriptions,
        });

        const [detail, match] = await Promise.all([
          getTransactionDetail(transactionId),
          getTransactionSubscriptionMatch(transactionId),
        ]);
        setTx(detail);
        setSubscriptionMatch(match);
        setSubscriptionModalOpen(false);
      } catch (e) {
        console.warn("link subscription error", e);
      } finally {
        setSubscriptionActionBusy(false);
      }
    },
    [transactionId, setCategoryToSubscriptions, subscriptionActionBusy],
  );

  const handleMarkNoSubscription = React.useCallback(async () => {
    if (!transactionId || subscriptionActionBusy) return;
    setSubscriptionActionBusy(true);
    try {
      await markTransactionAsNotSubscription(
        transactionId,
        "handmatig gemarkeerd vanuit transactie-detail",
      );
      const match = await getTransactionSubscriptionMatch(transactionId);
      setSubscriptionMatch(match);
      setSubscriptionModalOpen(false);
    } catch (e) {
      console.warn("ignore subscription error", e);
    } finally {
      setSubscriptionActionBusy(false);
    }
  }, [transactionId, subscriptionActionBusy]);

  const handleOpenSubscriptionAction = React.useCallback(() => {
    if (linkedSubscriptionProfile?.id) {
      router.push({
        pathname: "/subscriptions",
        params: { profileId: linkedSubscriptionProfile.id },
      });
      return;
    }
    setSubscriptionModalOpen(true);
  }, [linkedSubscriptionProfile?.id, router]);

  const handleOpenCreateSubscriptionProfile = React.useCallback(() => {
    if (!transactionId || !tx) return;

    setSubscriptionModalOpen(false);
    router.push({
      pathname: "/subscriptions",
      params: {
        createFromTransactionId: transactionId,
        createFromTransactionDate: tx.date,
        createFromTransactionCounterparty: tx.counterparty || "",
        createFromTransactionDetails: tx.details,
        createFromTransactionAmount: String(tx.amount),
        createFromTransactionProvider:
          detectProviderHintFromTransaction(tx.counterparty, tx.details) || "",
        createSetCategoryOnLink: setCategoryToSubscriptions ? "1" : "0",
      },
    });
  }, [router, setCategoryToSubscriptions, transactionId, tx]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={FinColors.green} size="large" />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Transactie niet gevonden.</Text>
      </View>
    );
  }

  const saldoNaTrn = parseSaldo(tx.metadata["Saldo na trn"]);
  const omschrijving = tx.details.split("|")[0]?.trim() || tx.details;
  const categoryStatusLabel = tx.category_id_user
    ? "Handmatig aangepast"
    : effectiveCategory
      ? null
      : "Controle nodig";
  const categoryStatusTone = tx.category_id_user
    ? styles.statusChipManual
    : styles.statusChipWarning;
  const categoryStatusTextTone = tx.category_id_user
    ? styles.statusChipTextManual
    : styles.statusChipTextWarning;

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <TransactionCategoryIcon row={tx} categoryById={categoryById} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.counterparty} numberOfLines={2}>
                {tx.counterparty || "Onbekende tegenpartij"}
              </Text>
              {categoryStatusLabel ? (
                <View style={[styles.statusChip, categoryStatusTone]}>
                  <Text style={[styles.statusChipText, categoryStatusTextTone]}>
                    {categoryStatusLabel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <Text
            style={[
              styles.heroAmount,
              { color: tx.amount < 0 ? FinColors.red : FinColors.green },
            ]}
          >
            {tx.amount < 0 ? "−" : "+"}
            {euroFormatter.format(Math.abs(tx.amount))}
          </Text>
          <Text style={styles.heroMetaText}>
            {tx.date}
            {saldoNaTrn != null
              ? ` • Saldo na transactie ${euroFormatter.format(saldoNaTrn)}`
              : ""}
          </Text>
          {subscriptionStatusLabel ? (
            <View style={styles.heroPillsRow}>
              <View
                style={[
                  styles.heroPill,
                  linkedSubscriptionProfile
                    ? styles.heroPillLinked
                    : styles.heroPillDetected,
                ]}
              >
                <Text
                  style={[
                    styles.heroPillText,
                    linkedSubscriptionProfile
                      ? styles.heroPillTextLinked
                      : styles.heroPillTextDetected,
                  ]}
                >
                  {subscriptionStatusLabel}
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={styles.categoryMain}>
              <Text style={styles.sectionTitle}>Categorie</Text>
              {effectiveCategory ? (
                <View style={styles.badgesRow}>
                  {parentCategory ? (
                    <Text style={styles.parentBadge}>{parentCategory.name}</Text>
                  ) : null}
                  <Text style={styles.categoryBadge}>{effectiveCategory.name}</Text>
                  {budgetGroupLabel ? (
                    <Text style={styles.budgetGroupBadge}>{budgetGroupLabel}</Text>
                  ) : null}
                  {incomeSemanticLabel ? (
                    <Text
                      style={[
                        styles.incomeSemanticBadge,
                        incomeSemantics?.kind === "expense_refund" &&
                          styles.incomeSemanticBadgeRefund,
                      ]}
                    >
                      {incomeSemanticLabel}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.mutedText}>Ongecategoriseerd</Text>
              )}
              {incomeSemanticLabel ? (
                <Text style={styles.mutedText}>
                  {incomeSemantics?.kind === "expense_refund"
                    ? "Deze ontvangst verlaagt vooral een kostenpost en telt niet als vast inkomen."
                    : incomeSemantics?.kind === "tax_refund"
                      ? "Deze ontvangst hoort bij deze maand, maar niet bij je vaste inkomensbasis."
                      : "Deze inkomensduiding wordt ook gebruikt in budget en insights."}
                </Text>
              ) : null}

              <View style={styles.quickActionsRow}>
                <View style={styles.quickToggleChip}>
                  <Text style={styles.quickToggleText}>Buiten budget</Text>
                  <Switch
                    value={tx.budget_excluded}
                    onValueChange={handleBudgetExcludedToggle}
                    disabled={budgetExclusionToggling}
                    trackColor={{
                      false: FinColors.bgElevated,
                      true: FinColors.red,
                    }}
                    thumbColor={
                      tx.budget_excluded ? FinColors.red : FinColors.textMuted
                    }
                  />
                </View>
                {effectiveCategory ? (
                  <TouchableOpacity
                    style={styles.quickActionChip}
                    onPress={() =>
                      router.push({
                        pathname: "/category-budget-groups",
                        params: { categoryId: effectiveCategory.id },
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={styles.quickActionChipText}>
                      Budgetgroep beheren
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.metaRow}>
                {tx.category_id_user ? (
                  <Text style={styles.sourcePill}>● Handmatig</Text>
                ) : tx.category_source ? (
                  <Text style={styles.sourcePill}>
                    ●{" "}
                    {tx.category_source === "rule"
                      ? "Regel"
                      : tx.category_source === "openai"
                        ? "AI"
                        : tx.category_source === "fallback"
                          ? "Onbekend"
                          : tx.category_source}
                  </Text>
                ) : null}
                {tx.category_confidence != null && !tx.category_id_user ? (
                  <Text style={styles.mutedText}>
                    {Math.round(tx.category_confidence * 100)}% zekerheid
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.categoryActionStack}>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  setShowPicker((v) => !v);
                  setAiState("idle");
                }}
                disabled={savingCategory}
              >
                <Text style={styles.primaryActionBtnText}>
                  {showPicker ? "Sluiten" : "Categorie wijzigen"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.secondaryActionBtn,
                  savingCategory && styles.btnDisabled,
                ]}
                onPress={() => void handleAiReclassify()}
                disabled={savingCategory}
              >
                <Text style={styles.secondaryActionBtnText}>
                  Herclassificeer via AI
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {aiState === "error" && aiError ? (
            <Text style={styles.errorText}>{aiError}</Text>
          ) : null}

          {aiState === "loading" ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={FinColors.green} size="small" />
              <Text style={styles.loadingText}>AI analyseert transactie…</Text>
            </View>
          ) : null}

          {aiState === "result" && aiSuggestion ? (
            <View style={styles.aiResultCard}>
              {aiSuggestion.isSameAsCurrent ? (
                <>
                  <Text style={styles.aiSameText}>
                    ✓ AI bevestigt de huidige categorie
                  </Text>
                  <Text style={styles.aiCategoryLine}>
                    {aiSuggestion.parentName
                      ? `${aiSuggestion.parentName} › ${aiSuggestion.categoryName}`
                      : aiSuggestion.categoryName}
                  </Text>
                  <Text style={styles.mutedText}>{aiSuggestion.reason}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.mutedText}>Suggestie van AI:</Text>
                  <Text style={styles.aiCategoryLine}>
                    {aiSuggestion.parentName
                      ? `${aiSuggestion.parentName} › ${aiSuggestion.categoryName}`
                      : aiSuggestion.categoryName}
                  </Text>
                  <Text style={styles.aiConf}>
                    {Math.round(aiSuggestion.confidence * 100)}% zekerheid
                  </Text>
                  <Text style={styles.mutedText}>{aiSuggestion.reason}</Text>
                  <View style={styles.aiActions}>
                    {!isSubjectDrivenProvider ? (
                      <TouchableOpacity
                        style={[styles.aiBtn, styles.aiBtnPrimary]}
                        onPress={() => void handleApplyAi(true)}
                        disabled={savingCategory}
                      >
                        <Text style={styles.aiBtnTextPrimary}>
                          Toepassen + regel
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.aiBtn}
                      onPress={() => void handleApplyAi(false)}
                      disabled={savingCategory}
                    >
                      <Text style={styles.aiBtnText}>Alleen toepassen</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ) : null}

          {showPicker ? (
            <View style={styles.pickerWrap}>
              {savingCategory ? (
                <ActivityIndicator
                  color={FinColors.green}
                  style={{ margin: 16 }}
                />
              ) : (
                categoryGroups.map((group) => (
                  <View key={group.parent?.id ?? "__root"}>
                    <Text style={styles.pickerGroup}>
                      {group.parent?.name ?? "Overige"}
                    </Text>
                    {group.leaves.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.pickerItem,
                          effectiveCategoryId === cat.id &&
                            styles.pickerItemActive,
                        ]}
                        onPress={() => void handleManualCategory(cat.id)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            effectiveCategoryId === cat.id &&
                              styles.pickerItemTextActive,
                          ]}
                        >
                          {cat.name}
                        </Text>
                        {effectiveCategoryId === cat.id ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Context</Text>
          <InfoRow label="Omschrijving" value={omschrijving} />
          <InfoRow
            label="Status budget"
            value={
              tx.budget_excluded ? "Buiten budget" : "Binnen budget opgenomen"
            }
          />
        </View>

        {isPspLikeExpense || linkedSubscriptionProfile ? (
          <View style={styles.subscriptionCard}>
            <Text style={styles.sectionTitle}>
              {linkedSubscriptionProfile ? "Abonnement" : "Mogelijk abonnement"}
            </Text>
            {linkedSubscriptionProfile ? (
              <Text style={styles.subscriptionLinkedText}>
                Gekoppeld aan abonnement: {linkedSubscriptionProfile.name}
              </Text>
            ) : subscriptionMatch?.match.matchSource === "ignored" ? (
              <Text style={styles.subscriptionMutedText}>
                Deze transactie is gemarkeerd als geen abonnement.
              </Text>
            ) : (
              <Text style={styles.subscriptionMutedText}>
                Deze PSP-betaling lijkt op een abonnement. Koppel om suggesties
                en beheer centraal te houden.
              </Text>
            )}

            <TouchableOpacity
              style={styles.subscriptionActionBtn}
              onPress={handleOpenSubscriptionAction}
            >
              <Text style={styles.subscriptionActionBtnText}>
                {linkedSubscriptionProfile
                  ? "Bekijk abonnement"
                  : "Koppel aan abonnement"}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setDetailsExpanded((value) => !value)}
        >
          <Text style={styles.expandBtnText}>
            {detailsExpanded ? "Minder details" : "Meer details"}
          </Text>
        </TouchableOpacity>

        {detailsExpanded ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Extra informatie</Text>
              {tx.type ? <InfoRow label="Type" value={tx.type} /> : null}
              {tx.currency ? <InfoRow label="Valuta" value={tx.currency} /> : null}
              {saldoNaTrn != null ? (
                <InfoRow
                  label="Saldo na transactie"
                  value={euroFormatter.format(saldoNaTrn)}
                />
              ) : null}
              {tx.created_at ? (
                <InfoRow
                  label="Aangemaakt op"
                  value={new Date(tx.created_at).toLocaleDateString("nl-NL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                />
              ) : null}
            </View>

            {bulkPhase !== "idle" && tx.counterparty ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Bijwerken:{" "}
                  <Text style={styles.counterpartyInline}>{tx.counterparty}</Text>
                </Text>
                {bulkPhase === "confirming" && bulkCounts ? (
                  <>
                    <Text style={styles.mutedText}>
                      Wil je ook andere transacties van deze tegenpartij bijwerken?
                    </Text>
                    <View style={styles.scopeRow}>
                      <TouchableOpacity
                        style={[
                          styles.scopeBtn,
                          bulkScope === "uncategorized" && styles.scopeBtnActive,
                        ]}
                        onPress={() => setBulkScope("uncategorized")}
                      >
                        <Text
                          style={[
                            styles.scopeBtnText,
                            bulkScope === "uncategorized" &&
                              styles.scopeBtnTextActive,
                          ]}
                        >
                          Ongecategoriseerde ({bulkCounts.uncategorized})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.scopeBtn,
                          bulkScope === "all" && styles.scopeBtnActive,
                        ]}
                        onPress={() => setBulkScope("all")}
                      >
                        <Text
                          style={[
                            styles.scopeBtnText,
                            bulkScope === "all" && styles.scopeBtnTextActive,
                          ]}
                        >
                          Alle ({bulkCounts.all})
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.bulkActions}>
                      <TouchableOpacity
                        style={[styles.primaryBtn, { flex: 1 }]}
                        onPress={() => void handleBulkUpdate()}
                      >
                        <Text style={styles.primaryBtnText}>Bijwerken</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ghostBtn, { flex: 1 }]}
                        onPress={() => setBulkPhase("idle")}
                      >
                        <Text style={styles.ghostBtnText}>Overslaan</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : bulkPhase === "updating" ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={FinColors.green} size="small" />
                    <Text style={styles.loadingText}>Transacties bijwerken…</Text>
                  </View>
                ) : bulkPhase === "done" ? (
                  <Text style={styles.aiSameText}>✓ Transacties bijgewerkt</Text>
                ) : null}
              </View>
            ) : null}

            {tx.counterparty ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Andere transacties:{" "}
                  <Text style={styles.counterpartyInline}>{tx.counterparty}</Text>
                </Text>
                {history.length === 0 ? (
                  <Text style={styles.mutedText}>
                    Geen andere transacties gevonden.
                  </Text>
                ) : (
                  history.map((item) => {
                    const categoryLabel = getCategoryPathLabel(item, categoryById);
                    const subject = getSubjectFromDetails(item.details);
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.historyItem}
                        onPress={() =>
                          router.push({
                            pathname: "/transaction-detail",
                            params: { id: item.id },
                          })
                        }
                      >
                        <View style={styles.historyIconWrap}>
                          <TransactionCategoryIcon
                            row={item}
                            categoryById={categoryById}
                          />
                        </View>
                        <View style={styles.historyLeft}>
                          <Text style={styles.historyDate}>{item.date}</Text>
                          <Text style={styles.historyDesc} numberOfLines={2}>
                            {item.subscriptionProfileName || subject}
                          </Text>
                          <Text style={styles.historyCat}>{categoryLabel}</Text>
                        </View>
                        <Text
                          style={[
                            styles.historyAmount,
                            {
                              color:
                                item.amount < 0 ? FinColors.red : FinColors.green,
                            },
                          ]}
                        >
                          {item.amount < 0 ? "−" : "+"}
                          {euroFormatter.format(Math.abs(item.amount))}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
                <TouchableOpacity
                  style={styles.viewAllBtn}
                  onPress={() =>
                    router.push(
                      `/transactions?counterparty=${encodeURIComponent(tx.counterparty!)}`,
                    )
                  }
                >
                  <Text style={styles.viewAllText}>
                    Bekijk alle transacties van {tx.counterparty} →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        ) : null}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal
        visible={subscriptionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSubscriptionModalOpen(false)}
      >
        <View style={styles.subscriptionModalOverlay}>
          <View style={styles.subscriptionModalCard}>
            <View style={styles.subscriptionModalHeaderRow}>
              <Text style={styles.subscriptionModalTitle}>
                Koppel abonnement
              </Text>
              <TouchableOpacity
                style={styles.subscriptionModalCloseBtn}
                onPress={() => setSubscriptionModalOpen(false)}
              >
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.subscriptionModalSubtitle}>
              {getSubjectFromDetails(tx.details)}
            </Text>

            <View style={styles.subscriptionToggleRow}>
              <Text style={styles.subscriptionToggleLabel}>
                Zet categorie op abonnementen
              </Text>
              <Switch
                value={setCategoryToSubscriptions}
                onValueChange={setSetCategoryToSubscriptions}
                trackColor={{
                  false: FinColors.bgElevated,
                  true: FinColors.greenBorder,
                }}
                thumbColor={
                  setCategoryToSubscriptions
                    ? FinColors.green
                    : FinColors.textMuted
                }
              />
            </View>

              <ScrollView
                style={styles.subscriptionProfileList}
                contentContainerStyle={styles.subscriptionProfileListContent}
              >
              {activeSubscriptionProfiles.length === 0 ? (
                <View style={styles.subscriptionQuickCreateWrap}>
                  <Text style={styles.subscriptionModalEmptyText}>
                    Geen actieve abonnementen gevonden.
                  </Text>
                  <Text style={styles.subscriptionQuickCreateHint}>
                    Maak direct een nieuw profiel aan met de gegevens van deze
                    betaling.
                  </Text>
                </View>
              ) : (
                activeSubscriptionProfiles.map((profile) => (
                  <TouchableOpacity
                    key={profile.id}
                    style={styles.subscriptionProfileRow}
                    onPress={() => void handleLinkToSubscription(profile.id)}
                    disabled={subscriptionActionBusy}
                  >
                    <Text style={styles.subscriptionProfileName}>
                      {profile.name}
                    </Text>
                    <Text style={styles.subscriptionProfileMeta}>
                      {profile.billingCycle === "quarterly"
                        ? "Per kwartaal"
                        : profile.billingCycle === "yearly"
                          ? "Jaarlijks"
                          : "Maandelijks"}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <View style={styles.subscriptionModalActionsRow}>
              <TouchableOpacity
                style={styles.subscriptionGhostBtn}
                onPress={() => void handleMarkNoSubscription()}
                disabled={subscriptionActionBusy}
              >
                <Text style={styles.subscriptionGhostBtnText}>
                  Geen abonnement
                </Text>
              </TouchableOpacity>
              {!linkedSubscriptionProfile ? (
                <TouchableOpacity
                  style={styles.subscriptionManageBtn}
                  onPress={handleOpenCreateSubscriptionProfile}
                  disabled={subscriptionActionBusy}
                >
                  <Text style={styles.subscriptionManageBtnText}>
                    Nieuw profiel
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: FinColors.bgBase },
  content: { padding: 16, gap: 12 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: FinColors.bgBase,
  },
  emptyText: { color: FinColors.textSecondary, fontSize: 15 },

  heroCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroIconWrap: {
    marginTop: 2,
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  heroAmount: { fontSize: 30, fontWeight: "700" },
  heroMetaText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  heroPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroPillLinked: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  heroPillDetected: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  heroPillTextLinked: {
    color: FinColors.green,
  },
  heroPillTextDetected: {
    color: FinColors.warningText,
  },
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitle: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.6,
  },
  counterpartyInline: {
    textTransform: "none",
    letterSpacing: 0,
    opacity: 1,
    fontWeight: "600",
    fontSize: 12,
  },

  // Header
  counterparty: {
    flex: 1,
    color: FinColors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 26,
  },
  categoryMain: { flex: 1, gap: 8 },
  categoryActionStack: {
    width: 180,
    alignItems: "flex-end",
    gap: 8,
    marginLeft: 12,
  },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusChipWarning: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  statusChipManual: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusChipTextWarning: { color: FinColors.warningText },
  statusChipTextManual: { color: FinColors.green },
  reviewedBox: { alignItems: "flex-end", gap: 8 },
  statusToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewedLabel: {
    color: FinColors.textMuted,
    fontSize: 11,
    textAlign: "right",
  },
  amount: { fontSize: 28, fontWeight: "700" },
  dateText: { color: FinColors.textSecondary, fontSize: 14 },

  // Info rows
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  infoLabel: { color: FinColors.textMuted, fontSize: 13, flex: 1 },
  infoValue: {
    color: FinColors.textPrimary,
    fontSize: 13,
    flex: 2,
    textAlign: "right",
  },

  // Category badges
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  parentBadge: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  categoryBadge: {
    color: FinColors.green,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  budgetGroupBadge: {
    color: FinColors.warningText,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  incomeSemanticBadge: {
    color: FinColors.green,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: "hidden",
  },
  incomeSemanticBadgeRefund: {
    color: FinColors.warningText,
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  sourcePill: { color: FinColors.textMuted, fontSize: 12 },
  mutedText: {
    color: FinColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  primaryActionBtn: {
    width: "100%",
    borderRadius: 10,
    backgroundColor: FinColors.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryActionBtnText: {
    color: FinColors.bgCard,
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    width: "100%",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryActionBtnText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  quickActionChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickActionChipText: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  quickToggleChip: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quickToggleText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  expandBtn: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingVertical: 12,
    alignItems: "center",
  },
  expandBtnText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  // Subscription hint
  subscriptionCard: {
    backgroundColor: FinColors.greenBg,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.greenBorder,
    padding: 14,
    gap: 8,
  },
  subscriptionLinkedText: {
    color: FinColors.green,
    fontSize: 14,
    fontWeight: "700",
  },
  subscriptionMutedText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  subscriptionActionBtn: {
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  subscriptionActionBtnText: {
    color: FinColors.green,
    fontSize: 13,
    fontWeight: "700",
  },

  // Subscription modal
  subscriptionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  subscriptionModalCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgCard,
    padding: 14,
    gap: 10,
    maxHeight: "80%",
  },
  subscriptionModalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subscriptionModalTitle: {
    color: FinColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  subscriptionModalCloseBtn: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subscriptionModalSubtitle: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  subscriptionToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  subscriptionToggleLabel: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  subscriptionProfileList: {
    maxHeight: 260,
  },
  subscriptionProfileListContent: {
    gap: 8,
  },
  subscriptionModalEmptyText: {
    color: FinColors.textMuted,
    fontSize: 13,
  },
  subscriptionQuickCreateWrap: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 10,
    gap: 8,
  },
  subscriptionQuickCreateHint: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  subscriptionQuickCreateInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    color: FinColors.textPrimary,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  subscriptionQuickCreateError: {
    color: FinColors.red,
    fontSize: 12,
  },
  subscriptionQuickCreateBtn: {
    borderRadius: 8,
    backgroundColor: FinColors.green,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionQuickCreateBtnText: {
    color: FinColors.bgBase,
    fontSize: 13,
    fontWeight: "700",
  },
  subscriptionProfileRow: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  subscriptionProfileName: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  subscriptionProfileMeta: {
    color: FinColors.textMuted,
    fontSize: 12,
  },
  subscriptionModalActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  subscriptionGhostBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  subscriptionGhostBtnText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  subscriptionManageBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: FinColors.green,
    paddingVertical: 12,
    alignItems: "center",
  },
  subscriptionManageBtnText: {
    color: FinColors.bgBase,
    fontSize: 13,
    fontWeight: "700",
  },

  // Small button
  smallBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  smallBtnText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },

  // Category picker
  pickerWrap: {
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FinColors.border,
    paddingTop: 12,
  },
  pickerGroup: {
    color: FinColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pickerItemActive: { backgroundColor: FinColors.greenBg },
  pickerItemText: { color: FinColors.textPrimary, fontSize: 14 },
  pickerItemTextActive: { color: FinColors.green, fontWeight: "600" },
  checkmark: { color: FinColors.green, fontSize: 16 },

  // Buttons
  primaryBtn: {
    backgroundColor: FinColors.green,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: FinColors.bgBase,
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  ghostBtnText: {
    color: FinColors.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },

  // Loading
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 6,
  },
  loadingText: { color: FinColors.textSecondary, fontSize: 14 },
  providerHint: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: FinColors.red,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  // AI result
  aiResultCard: {
    backgroundColor: FinColors.bgElevated,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  aiSameText: { color: FinColors.green, fontSize: 14, fontWeight: "600" },
  aiCategoryLine: {
    color: FinColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  aiConf: { color: FinColors.textSecondary, fontSize: 12 },
  aiActions: { gap: 8, marginTop: 4 },
  aiBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  aiBtnPrimary: { backgroundColor: FinColors.green, borderWidth: 0 },
  aiBtnText: { color: FinColors.textPrimary, fontSize: 14, fontWeight: "600" },
  aiBtnTextPrimary: {
    color: FinColors.bgBase,
    fontSize: 14,
    fontWeight: "700",
  },

  // Bulk update
  scopeRow: { flexDirection: "row", gap: 8 },
  scopeBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  scopeBtnActive: {
    backgroundColor: FinColors.greenBg,
    borderColor: FinColors.greenBorder,
  },
  scopeBtnText: {
    color: FinColors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  scopeBtnTextActive: { color: FinColors.green, fontWeight: "600" },
  bulkActions: { flexDirection: "row", gap: 8 },

  // History
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: FinColors.border,
    gap: 10,
  },
  historyIconWrap: {
    marginRight: 2,
  },
  historyLeft: { flex: 1, gap: 3 },
  historyDate: { color: FinColors.textSecondary, fontSize: 13 },
  historyDesc: {
    color: FinColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  historyCat: {
    color: FinColors.textMuted,
    fontSize: 11,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 4,
    alignSelf: "flex-start",
    overflow: "hidden",
  },
  historyAmount: { fontSize: 15, fontWeight: "600" },
  viewAllBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: FinColors.border,
  },
  viewAllText: { color: FinColors.green, fontSize: 14, fontWeight: "600" },
});
