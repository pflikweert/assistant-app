import {
  FinanceTransactionsBlock,
  type FinanceTransactionsBlockItem,
} from "@/components/transactions/finance-transactions-block";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinanceCircleIconButton } from "@/components/ui/finance-circle-icon-button";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceBudgetStatusToggle } from "@/components/ui/finance-budget-status-toggle";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceModalTopBar } from "@/components/ui/finance-modal-top-bar";
import { FinanceSubscriptionCallout } from "@/components/ui/finance-subscription-callout";
import { FinanceQuickMenu } from "@/components/navigation/finance-quick-menu";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceTextBlock } from "@/components/ui/finance-text-block";
import { FinColors } from "@/constants/theme";
import { BUDGET_GROUP_LABELS } from "@/services/category-budget-groups";
import { resolveTransactionCategoryIconName } from "@/services/category-icon";
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
} from "@/types/categorization";
import { useIsFocused } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
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
const CONTENT_MAX_WIDTH = 1040;

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function readMetadataString(
  metadata: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function formatPaymentAccount(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  const ibanLike = /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(compact);
  if (!ibanLike) return value;

  const bankCode = compact.slice(4, 8);
  const bankNames: Record<string, string> = {
    INGB: "ING",
    RABO: "Rabobank",
    ABNA: "ABN AMRO",
    SNSB: "SNS",
    ASN: "ASN Bank",
    KNAB: "Knab",
    TRIO: "Triodos",
    BUNQ: "bunq",
  };
  const bankName = bankNames[bankCode];
  const last4 = compact.slice(-4);
  return bankName
    ? `${bankName} betaalrekening (**** ${last4})`
    : `Betaalrekening (**** ${last4})`;
}

function resolvePaymentMethodFromMetadata(
  metadata: Record<string, unknown>,
): string | null {
  const bankName = readMetadataString(metadata, [
    "Naam rekening",
    "Rekening naam",
    "Naam bank",
    "Bank",
    "Account name",
  ]);
  const method = readMetadataString(metadata, [
    "Betaalmethode",
    "Betaal methode",
    "Betaalpas",
    "Betaalwijze",
    "Methode",
    "Kanaal",
  ]);
  const maskedCard = readMetadataString(metadata, [
    "Pasnummer",
    "Pas nr",
    "Pasnr",
    "Kaartnummer",
    "Card",
    "Card last4",
    "Laatste 4 cijfers",
  ]);
  const accountRef = readMetadataString(metadata, [
    "IBAN/BBAN",
    "IBAN",
    "Rekening",
    "Rekeningnummer",
    "Rekening nummer",
    "Account",
    "Account number",
    "Accountnummer",
  ]);
  const tegenRekeningRef = readMetadataString(metadata, [
    "Tegenrekening IBAN/BBAN",
  ]);
  const resolvedAccount = accountRef || tegenRekeningRef;
  const accountLabel = resolvedAccount
    ? formatPaymentAccount(resolvedAccount)
    : null;

  const suffix = maskedCard
    ? maskedCard.startsWith("(")
      ? ` ${maskedCard}`
      : ` (${maskedCard})`
    : accountLabel
      ? accountLabel.startsWith("(")
        ? ` ${accountLabel}`
        : ` (${accountLabel})`
      : "";

  if (bankName && method) return `${bankName} ${method}${suffix}`;
  if (method) return `${method}${suffix}`;
  if (bankName && accountLabel) return `${bankName} (${accountLabel})`;
  if (accountLabel) return accountLabel;
  if (bankName) return bankName;
  return null;
}

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function formatTransactionDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatHistoryDateLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

  const blurActiveWebElement = React.useCallback(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const activeElement = document.activeElement as HTMLElement | null;
    activeElement?.blur?.();
  }, []);

  const closeSubscriptionModal = React.useCallback(() => {
    blurActiveWebElement();
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.setTimeout(() => {
        setSubscriptionModalOpen(false);
      }, 0);
      return;
    }
    setSubscriptionModalOpen(false);
  }, [blurActiveWebElement]);

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
  const historyItems = React.useMemo<FinanceTransactionsBlockItem[]>(
    () =>
      history.map((item) => {
        const subject = getSubjectFromDetails(item.details);
        const categoryLabel = getCategoryPathLabel(item, categoryById);
        return {
          id: item.id,
          title: item.subscriptionProfileName || item.counterparty || subject || "Onbekende tegenpartij",
          subtitle: subject,
          meta: categoryLabel,
          dateLabel: formatHistoryDateLabel(item.date),
          amount: item.amount,
          categoryAutoId: item.category_id_auto,
          categoryUserId: item.category_id_user,
          runningBalance: null,
        };
      }),
    [history, categoryById],
  );

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
          6,
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
        console.warn("setCategory error", e);
      } finally {
        setSavingCategory(false);
      }
    },
    [transactionId, tx?.counterparty],
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
        6,
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
        closeSubscriptionModal();
      } catch (e) {
        console.warn("link subscription error", e);
      } finally {
        setSubscriptionActionBusy(false);
      }
    },
    [
      closeSubscriptionModal,
      transactionId,
      setCategoryToSubscriptions,
      subscriptionActionBusy,
    ],
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
      closeSubscriptionModal();
    } catch (e) {
      console.warn("ignore subscription error", e);
    } finally {
      setSubscriptionActionBusy(false);
    }
  }, [closeSubscriptionModal, transactionId, subscriptionActionBusy]);

  const handleOpenSubscriptionAction = React.useCallback(() => {
    if (linkedSubscriptionProfile?.id) {
      router.push({
        pathname: "/subscriptions",
        params: { profileId: linkedSubscriptionProfile.id },
      });
      return;
    }
    blurActiveWebElement();
    setSubscriptionModalOpen(true);
  }, [blurActiveWebElement, linkedSubscriptionProfile?.id, router]);

  const handleOpenCreateSubscriptionProfile = React.useCallback(() => {
    if (!transactionId || !tx) return;

    blurActiveWebElement();
    const navigate = () => {
      router.push({
        pathname: "/subscriptions",
        params: {
          createFromTransactionId: transactionId,
          createFromTransactionDate: tx.date,
          createFromTransactionCounterparty: tx.counterparty || "",
          createFromTransactionDetails: tx.details,
          createFromTransactionAmount: String(tx.amount),
          createFromTransactionProvider: "",
          createSetCategoryOnLink: setCategoryToSubscriptions ? "1" : "0",
        },
      });
    };

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.setTimeout(() => {
        setSubscriptionModalOpen(false);
        navigate();
      }, 0);
      return;
    }

    setSubscriptionModalOpen(false);
    navigate();
  }, [blurActiveWebElement, router, setCategoryToSubscriptions, transactionId, tx]);

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
  const transactionDateLabel = formatTransactionDateLabel(tx.date);
  const paymentMethodLabel =
    resolvePaymentMethodFromMetadata(tx.metadata) || "Onbekend";
  const categoryIconName = resolveTransactionCategoryIconName(
    {
      category_id_auto: tx.category_id_auto,
      category_id_user: tx.category_id_user,
    },
    categoryById,
  ) as AppIconName;
  const budgetBucketLabel = (() => {
    const budgetGroup = String(effectiveCategory?.budget_group || "").toLowerCase();
    if (budgetGroup === "fixed") return BUDGET_GROUP_LABELS.fixed;
    if (budgetGroup === "variable") return BUDGET_GROUP_LABELS.variable;
    if (budgetGroup === "subscriptions") return BUDGET_GROUP_LABELS.subscriptions;
    if (budgetGroup === "savings") return BUDGET_GROUP_LABELS.savings;
    return null;
  })();
  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDetailTopBar
        title="Transactie"
        onBack={() => router.back()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <FinanceHeroShell
          shellStyle={styles.heroShell}
          innerStyle={styles.heroInner}
          eyebrow="Transactie detail"
          title={tx.counterparty || "Onbekende tegenpartij"}
          subtitle={`${tx.amount < 0 ? "−" : "+"}${euroFormatter.format(Math.abs(tx.amount))}`}
          titleStyle={styles.heroTitle}
          subtitleStyle={styles.heroAmountLine}
          subtitleLineStyle={styles.heroAmountWrap}
        >
          <View style={styles.heroMetaRow}>
            <Text style={styles.heroMetaText}>{transactionDateLabel}</Text>
            {saldoNaTrn != null ? (
              <View style={styles.heroSaldoPill}>
                <Text style={styles.heroSaldoPillText}>
                  Saldo: {euroFormatter.format(saldoNaTrn)}
                </Text>
              </View>
            ) : null}
          </View>
        </FinanceHeroShell>

        <View style={styles.mainColumn}>
          <FinanceTextBlock label="Omschrijving" style={styles.textBlock}>
            <Text style={styles.descriptionText}>{omschrijving}</Text>
          </FinanceTextBlock>

          <FinanceTextBlock
            label="Categorie"
            style={styles.textBlock}
          >
            <View style={styles.categoryContentRow}>
              <View style={styles.categoryPathWrap}>
                {effectiveCategory ? (
                  <View style={styles.categoryDisplayRow}>
                    <View style={styles.categoryInlineIconWrap}>
                      <AppIcon
                        name={categoryIconName}
                        size={18}
                        color={FinColors.textSecondary}
                        variant="outlined"
                      />
                    </View>
                    <View style={styles.categoryPathRow}>
                      <Text style={styles.categoryPathParent}>
                        {parentCategory?.name || effectiveCategory.name}
                      </Text>
                      {parentCategory ? (
                        <>
                          <Text style={styles.categoryPathSeparator}>›</Text>
                          <Text style={styles.categoryPathChild}>
                            {effectiveCategory.name}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <Text style={styles.mutedText}>Ongecategoriseerd</Text>
                )}
              </View>
              <FinanceCircleIconButton
                icon="edit"
                iconColor={FinColors.textPrimary}
                onPress={() => setShowPicker((v) => !v)}
                disabled={savingCategory}
                accessibilityLabel="Bewerk categorie"
                style={styles.categoryEditButton}
              />
            </View>
          </FinanceTextBlock>

          <FinanceTextBlock label="Betaald via" style={styles.textBlock}>
            <View style={styles.paymentMethodRow}>
              <View style={styles.paymentMethodIconWrap}>
                <AppIcon
                  name="payments"
                  size={18}
                  color={FinColors.textSecondary}
                  variant="outlined"
                />
              </View>
              <Text style={styles.paymentMethodValue} numberOfLines={2}>
                {paymentMethodLabel}
              </Text>
            </View>
          </FinanceTextBlock>

          {showPicker ? (
            <FinanceDetailCard style={styles.pickerCard}>
              {savingCategory ? (
                <ActivityIndicator color={FinColors.green} style={{ margin: 16 }} />
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
            </FinanceDetailCard>
          ) : null}

        <FinanceBudgetStatusToggle
          excluded={tx.budget_excluded}
          onToggle={handleBudgetExcludedToggle}
          disabled={budgetExclusionToggling}
          budgetBucketLabel={budgetBucketLabel}
        />

        {isPspLikeExpense || linkedSubscriptionProfile ? (
          <FinanceSubscriptionCallout
            title={linkedSubscriptionProfile ? "Abonnement gekoppeld" : "Mogelijk abonnement"}
            description={
              linkedSubscriptionProfile
                ? `Gekoppeld aan ${linkedSubscriptionProfile.name}.`
                : "We hebben dit herkend als een vaste last."
            }
            actionLabel={linkedSubscriptionProfile ? "Bekijk abonnement" : "Koppel aan abonnement"}
            onPress={handleOpenSubscriptionAction}
          />
        ) : null}

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
          <FinanceTransactionsBlock
            title="Historie"
            items={historyItems}
            categoryById={categoryById}
            maxItems={6}
            onPressItem={(id) =>
              router.push({
                pathname: "/transaction-detail",
                params: { id },
              })
            }
            onPressSeeAll={() =>
              router.push(
                `/transactions?counterparty=${encodeURIComponent(tx.counterparty!)}`,
              )
            }
            seeAllLabel="Bekijk alles"
            showRunningBalance={false}
            emptyTitle="Geen andere transacties"
            emptyDescription={`We vonden nog geen andere transacties van ${tx.counterparty}.`}
          />
        ) : null}

        <View style={{ height: 32 }} />
        </View>
      </ScrollView>

      <FinanceQuickMenu
        activeKey="transactions"
        onSelect={(key) => {
          if (key === "index") {
            router.push("/");
          } else if (key === "budget") {
            router.push("/budget");
          } else if (key === "transactions") {
            router.push("/transactions");
          } else if (key === "insights") {
            router.push("/insights");
          }
        }}
      />

      <Modal
        visible={subscriptionModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          closeSubscriptionModal();
        }}
      >
        <View style={styles.subscriptionModalOverlay}>
          <View style={styles.subscriptionModalCard}>
            <FinanceModalTopBar
              title="Koppel abonnement"
              subtitle={getSubjectFromDetails(tx.details)}
              onClose={() => {
                closeSubscriptionModal();
              }}
            />

            <View style={styles.subscriptionModalBody}>
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
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
    marginTop: -1,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 132,
    overflow: "hidden",
    gap: 32,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: FinColors.bgBase,
  },
  emptyText: { color: FinColors.textSecondary, fontSize: 15 },

  heroShell: {
    marginHorizontal: -16,
    marginTop: 0,
    backgroundColor: FinColors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.06)",
  },
  heroInner: {
    paddingTop: 32,
    paddingBottom: 18,
    gap: 10,
  },
  heroTitle: {
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.5,
  },
  heroAmountLine: {
    fontSize: 28,
    lineHeight: 30,
    color: FinColors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  heroAmountWrap: {
    borderLeftWidth: 0,
    paddingLeft: 0,
    marginTop: 0,
  },
  heroMetaRow: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    alignSelf: "flex-start",
  },
  heroMetaText: {
    color: FinColors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: FinColors.borderSubtle,
  },
  heroSaldoPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  heroSaldoPillText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  textBlock: {
    gap: 4,
  },
  categoryBlock: {
    flex: 1,
    gap: 8,
  },
  pickerCard: {
    paddingTop: 10,
    gap: 10,
  },
  subscriptionChipLinked: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  subscriptionChipDetected: {
    backgroundColor: FinColors.yellowSoft,
    borderColor: FinColors.warningBorder,
  },
  subscriptionChipTextLinked: {
    color: FinColors.warningText,
  },
  subscriptionChipTextDetected: {
    color: FinColors.warningText,
  },
  typeChip: {
    backgroundColor: FinColors.bgElevated,
    borderColor: FinColors.borderSubtle,
  },
  typeChipText: {
    color: FinColors.textSecondary,
  },
  mainColumn: {
    width: "100%",
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: "center",
    gap: 32,
  },
  detailCard: {
    marginTop: 2,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    color: FinColors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.6,
  },
  descriptionText: {
    color: FinColors.textPrimary,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryEditButton: {
    marginLeft: 12,
    alignSelf: "center",
  },
  categoryContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  categoryPathWrap: {
    flex: 1,
    minWidth: 0,
  },
  categoryDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  categoryInlineIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paymentMethodIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentMethodValue: {
    flex: 1,
    color: FinColors.textSecondary,
    fontSize: 25 / 2,
    lineHeight: 19,
    fontWeight: "500",
  },
  categoryPathRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  categoryPathParent: {
    fontSize: 15,
    fontWeight: "800",
    color: FinColors.textPrimary,
    flexShrink: 1,
  },
  categoryPathSeparator: {
    color: FinColors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  categoryPathChild: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textSecondary,
    flexShrink: 1,
  },
  categoryMetaText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  statusCopy: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  actionTile: {
    flex: 1,
    minWidth: 96,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionTileWarning: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  actionTileIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgCard,
  },
  actionTileIconWarning: {
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  actionTileLabel: {
    color: FinColors.textPrimary,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
  },
  calloutCard: {
    gap: 14,
  },
  calloutRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  calloutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  calloutCopy: {
    flex: 1,
    gap: 6,
  },
  calloutTitle: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  calloutText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  calloutButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: FinColors.warningText,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calloutButtonText: {
    color: FinColors.yellowSoft,
    fontWeight: "800",
    fontSize: 13,
  },
  historyLink: {
    color: FinColors.warningText,
    fontSize: 12,
    fontWeight: "800",
  },
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

  heroCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 28,
    padding: 20,
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
  heroAmount: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8 },
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
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
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
    color: FinColors.warningText,
  },
  heroPillTextDetected: {
    color: FinColors.warningText,
  },
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 18,
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
    letterSpacing: 2,
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
    fontSize: 22,
    fontWeight: "800",
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
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusChipTextWarning: { color: FinColors.warningText },
  statusChipTextManual: { color: FinColors.warningText },
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
  amount: { fontSize: 30, fontWeight: "800" },
  dateText: { color: FinColors.textSecondary, fontSize: 14 },

  // Category badges
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  parentBadge: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  categoryBadge: {
    color: FinColors.warningText,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
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
    borderRadius: 999,
    overflow: "hidden",
  },
  incomeSemanticBadge: {
    color: FinColors.warningText,
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
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryActionBtnText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryActionBtn: {
    width: "100%",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgInput,
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
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  quickActionChipText: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "700",
  },
  quickToggleChip: {
    borderRadius: 999,
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
    display: "none",
    borderRadius: 999,
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

  // Subscription modal
  subscriptionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  subscriptionModalCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgCard,
    overflow: "hidden",
    maxHeight: "80%",
  },
  subscriptionModalBody: {
    padding: 14,
    gap: 10,
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
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    padding: 10,
    gap: 8,
  },
  subscriptionQuickCreateHint: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  subscriptionQuickCreateInput: {
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  subscriptionQuickCreateBtnText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  subscriptionProfileRow: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgInput,
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
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingVertical: 12,
    alignItems: "center",
  },
  subscriptionManageBtnText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },

  // Small button
  smallBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 999,
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
  pickerItemActive: { backgroundColor: FinColors.warningBg },
  pickerItemText: { color: FinColors.textPrimary, fontSize: 14 },
  pickerItemTextActive: { color: FinColors.warningText, fontWeight: "600" },
  checkmark: { color: FinColors.warningText, fontSize: 16 },

  // Buttons
  primaryBtn: {
    backgroundColor: FinColors.yellow,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  primaryBtnText: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: { opacity: 0.4 },
  ghostBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 999,
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
    backgroundColor: FinColors.bgInput,
    borderRadius: 20,
    padding: 14,
    gap: 8,
  },
  aiSameText: { color: FinColors.warningText, fontSize: 14, fontWeight: "600" },
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
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  aiBtnPrimary: { backgroundColor: FinColors.yellow, borderWidth: 0 },
  aiBtnText: { color: FinColors.textPrimary, fontSize: 14, fontWeight: "600" },
  aiBtnTextPrimary: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },

  // Bulk update
  scopeRow: { flexDirection: "row", gap: 8 },
  scopeBtn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.border,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  scopeBtnActive: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
  scopeBtnText: {
    color: FinColors.textMuted,
    fontSize: 12,
    textAlign: "center",
  },
  scopeBtnTextActive: { color: FinColors.warningText, fontWeight: "600" },
  bulkActions: { flexDirection: "row", gap: 8 },

});
