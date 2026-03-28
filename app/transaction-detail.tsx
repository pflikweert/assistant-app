import {
  FinanceTransactionsBlock,
  type FinanceTransactionsBlockItem,
} from "@/components/transactions/finance-transactions-block";
import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinanceCircleIconButton } from "@/components/ui/finance-circle-icon-button";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceBudgetStatusToggle } from "@/components/ui/finance-budget-status-toggle";
import { FinanceDetailShell } from "@/components/ui/finance-detail-shell";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceModalTopBar } from "@/components/ui/finance-modal-top-bar";
import {
  FinanceCategoryGroupCard,
  FinanceCategoryLeafRow,
  FinanceFlatChoiceCard,
} from "@/components/ui/finance-category-sheet";
import { FinanceSubscriptionCallout } from "@/components/ui/finance-subscription-callout";
import { FinanceQuickMenu } from "@/components/navigation/finance-quick-menu";
import { FinanceTextBlock } from "@/components/ui/finance-text-block";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { BUDGET_GROUP_LABELS } from "@/services/category-budget-groups";
import { resolveTransactionCategoryIconName } from "@/services/category-icon";
import { formatSignedCurrency } from "@/services/ui-formatters/currency";
import { recategorizeTransactionWithAI } from "@/services/transaction-ai-categorization";
import {
  bulkUpdateCategoryByCounterparty,
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
  getTransactionRuleMatch,
  resetTransactionRuleMatch,
  type TransactionRuleMatch,
} from "@/services/transaction-rule-management";
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
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});
const CATEGORY_SCROLL_CONTEXT_OFFSET = Platform.OS === "web" ? 56 : -24;

function parseSaldo(value: unknown): number | null {
  if (value == null) return null;
  const s = String(value).replace(/\./g, "").replace(",", ".").trim();
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function formatMaskedAccountSuffix(masked: string | null | undefined): string | null {
  const trimmed = String(masked || "").trim();
  if (!trimmed) return null;

  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly.length >= 4) {
    return `**** ${digitsOnly.slice(-4)}`;
  }

  return trimmed.replace(/\s+/g, "") || null;
}

function resolvePaymentMethodFromLinkedAccount(tx: TransactionDetail): string {
  const linkedAccount = tx.linked_bank_account;
  if (!linkedAccount) return "Onbekend";

  const accountName = String(linkedAccount.name || "").trim() || "Betaalrekening";
  const maskedSuffix = formatMaskedAccountSuffix(linkedAccount.account_masked);
  if (!maskedSuffix) return accountName;
  return `${accountName} (${maskedSuffix})`;
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

function formatHistoryAllLabel(counterparty: string | null | undefined) {
  const raw = String(counterparty || "").trim();
  if (!raw) return "Alles";
  const maxNameChars = 14;
  const compactName =
    raw.length > maxNameChars ? `${raw.slice(0, maxNameChars - 3)}...` : raw;
  return `Alles van ${compactName}`;
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

function normalizeCategorySearchText(value: string | null | undefined) {
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
  const [categorySheetOpen, setCategorySheetOpen] = React.useState(false);
  const [categorySheetExpandedGroupId, setCategorySheetExpandedGroupId] =
    React.useState<string | null>(null);
  const [savingCategory, setSavingCategory] = React.useState(false);
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
  const [categoryRuleMatch, setCategoryRuleMatch] =
    React.useState<TransactionRuleMatch | null>(null);
  const [categoryRuleResetBusy, setCategoryRuleResetBusy] =
    React.useState(false);
  const [historyFilterMode, setHistoryFilterMode] = React.useState<
    "all" | "same_category"
  >("same_category");
  const [categoryChangeMode, setCategoryChangeMode] = React.useState<
    "ai" | "manual"
  >("ai");
  const [showCategoryOptions, setShowCategoryOptions] = React.useState(false);
  const [categorySearchInput, setCategorySearchInput] = React.useState("");
  const [draftCategoryId, setDraftCategoryId] = React.useState<string | null>(
    null,
  );
  const [draftApplyCategoryToCounterparty, setDraftApplyCategoryToCounterparty] =
    React.useState(false);
  const [draftLearnCategoryFromCounterparty, setDraftLearnCategoryFromCounterparty] =
    React.useState(false);
  const categorySheetScrollRef = React.useRef<ScrollView | null>(null);
  const categoryGroupLayoutYRef = React.useRef(new Map<string, number>());
  const categoryLeafLayoutYRef = React.useRef(new Map<string, number>());
  const categorySheetScrolledRef = React.useRef(false);
  const categoryScrollTargetRef = React.useRef<{
    groupId: string;
    leafId?: string | null;
  } | null>(null);

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
  const normalizedCategorySearch = React.useMemo(
    () => normalizeCategorySearchText(categorySearchInput),
    [categorySearchInput],
  );
  const filteredCategoryGroups = React.useMemo(() => {
    if (!normalizedCategorySearch) return categoryGroups;

    return categoryGroups
      .map((group) => {
        const parentName = group.parent?.name || "Overige";
        const groupMatch = normalizeCategorySearchText(parentName).includes(
          normalizedCategorySearch,
        );
        const leaves = groupMatch
          ? group.leaves
          : group.leaves.filter((leaf) =>
              normalizeCategorySearchText(leaf.name).includes(
                normalizedCategorySearch,
              ),
            );
        return { ...group, leaves };
      })
      .filter((group) => group.leaves.length > 0);
  }, [categoryGroups, normalizedCategorySearch]);

  const effectiveCategoryId =
    tx?.category_id_user || tx?.category_id_auto || null;

  const categorySheetInitialGroupId = React.useMemo(() => {
    if (!categoryGroups.length) return null;
    if (!effectiveCategoryId) {
      return categoryGroups[0]?.parent?.id || "__root";
    }
    const selectedGroup = categoryGroups.find((group) =>
      group.leaves.some((cat) => cat.id === effectiveCategoryId),
    );
    return selectedGroup?.parent?.id || categoryGroups[0]?.parent?.id || "__root";
  }, [categoryGroups, effectiveCategoryId]);

  const effectiveCategory = effectiveCategoryId
    ? categoryById.get(effectiveCategoryId) || null
    : null;
  const parentCategory = effectiveCategory?.parent_id
    ? categoryById.get(effectiveCategory.parent_id) || null
    : null;
  const categoryAttributionLabel = React.useMemo(() => {
    if (!tx) return null;
    if (tx.category_id_user) return "Handmatig";
    if (tx.category_source === "openai" && tx.category_confidence != null) {
      return `AI ${Math.round(tx.category_confidence * 100)}%`;
    }
    if (tx.category_source === "rule" && tx.category_confidence != null) {
      return `Regel ${Math.round(tx.category_confidence * 100)}%`;
    }
    if (tx.category_source === "fallback" && tx.category_confidence != null) {
      return `Schatting ${Math.round(tx.category_confidence * 100)}%`;
    }
    if (tx.category_confidence != null) {
      return `${Math.round(tx.category_confidence * 100)}%`;
    }
    return null;
  }, [tx]);
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
  const filteredHistoryItems = React.useMemo(() => {
    if (historyFilterMode !== "same_category" || !effectiveCategoryId) {
      return historyItems;
    }
    return historyItems.filter((item) => {
      const itemCategoryId = item.categoryUserId || item.categoryAutoId || null;
      return itemCategoryId === effectiveCategoryId;
    });
  }, [effectiveCategoryId, historyFilterMode, historyItems]);
  const historyAllLabel = React.useMemo(
    () => formatHistoryAllLabel(tx?.counterparty),
    [tx?.counterparty],
  );
  const historyAllSelected =
    historyFilterMode === "all" ||
    (historyFilterMode === "same_category" && !effectiveCategoryId);
  const historySameCategorySelected =
    historyFilterMode === "same_category" && Boolean(effectiveCategoryId);

  // ── Data loading ────────────────────────────────────────────────────────
  const loadData = React.useCallback(async () => {
    if (!transactionId) {
      setTx(null);
      setCategoryRuleMatch(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [detail, cats, profiles, match, ruleMatch] = await Promise.all([
        getTransactionDetail(transactionId),
        getTransactionCategories(),
        listSubscriptionProfiles(),
        getTransactionSubscriptionMatch(transactionId),
        getTransactionRuleMatch(transactionId),
      ]);
      setTx(detail);
      setCategories(cats);
      setSubscriptionProfiles(profiles);
      setSubscriptionMatch(match);
      setCategoryRuleMatch(ruleMatch);
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

  const refreshTransactionSnapshot = React.useCallback(async () => {
    if (!transactionId) return;
    const [detail, ruleMatch] = await Promise.all([
      getTransactionDetail(transactionId),
      getTransactionRuleMatch(transactionId),
    ]);
    setTx(detail);
    setCategoryRuleMatch(ruleMatch);
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
  }, [transactionId]);

  const tryScrollCategoryTarget = React.useCallback(() => {
    const target = categoryScrollTargetRef.current;
    if (!target) return false;

    const leafKey = target.leafId ? `${target.groupId}:${target.leafId}` : null;
    const leafY = leafKey ? categoryLeafLayoutYRef.current.get(leafKey) : null;
    const groupY = categoryGroupLayoutYRef.current.get(target.groupId);
    const targetY =
      leafY != null && groupY != null
        ? groupY + leafY - CATEGORY_SCROLL_CONTEXT_OFFSET
        : groupY != null
          ? groupY - CATEGORY_SCROLL_CONTEXT_OFFSET
          : leafY != null
            ? leafY - CATEGORY_SCROLL_CONTEXT_OFFSET
            : null;

    if (targetY == null) return false;

    categorySheetScrollRef.current?.scrollTo({
      y: Math.max(targetY, 0),
      animated: false,
    });
    categorySheetScrolledRef.current = true;
    categoryScrollTargetRef.current = null;
    return true;
  }, []);

  const scrollCategoryGroupIntoView = React.useCallback(
    (groupId: string | null, leafId?: string | null) => {
      if (!groupId) return;

      categorySheetScrolledRef.current = false;
      categoryScrollTargetRef.current = { groupId, leafId };
      setCategorySheetExpandedGroupId(groupId);

      requestAnimationFrame(() => {
        void tryScrollCategoryTarget();
      });
    },
    [tryScrollCategoryTarget],
  );

  // ── Manual category ─────────────────────────────────────────────────────
  const handleApplyCategoryChanges = React.useCallback(async () => {
    if (!transactionId) return;
    if (categoryChangeMode === "ai") {
      const shouldLearnFromCounterparty =
        draftLearnCategoryFromCounterparty &&
        !!tx?.counterparty &&
        !isSubjectDrivenCounterparty(tx.counterparty);
      const shouldUpdateCounterparty = draftApplyCategoryToCounterparty;
      setSavingCategory(true);
      try {
        const result = await recategorizeTransactionWithAI(transactionId, {
          applyToCounterparty: shouldUpdateCounterparty,
          learnFromCounterparty: shouldLearnFromCounterparty,
        });
        if (result?.categoryId) {
          setDraftCategoryId(result.categoryId);
        }
        setCategorySheetOpen(false);
        setDraftApplyCategoryToCounterparty(false);
        setDraftLearnCategoryFromCounterparty(false);
        await refreshTransactionSnapshot();
      } catch (e) {
        console.warn("ai recategorize apply error", e);
      } finally {
        setSavingCategory(false);
      }
      return;
    }

    const categoryId = draftCategoryId;
    const shouldLearnFromCounterparty =
      draftLearnCategoryFromCounterparty &&
      !!tx?.counterparty &&
      !isSubjectDrivenCounterparty(tx.counterparty);
    const shouldUpdateCounterparty = draftApplyCategoryToCounterparty;
    const currentCategoryId = tx?.category_id_user || tx?.category_id_auto || null;
    const isNoOp =
      categoryId === currentCategoryId &&
      !shouldLearnFromCounterparty &&
      !shouldUpdateCounterparty;

    if (!categoryId || isNoOp) {
      setCategorySheetOpen(false);
      return;
    }

    setSavingCategory(true);
    try {
      await setTransactionManualCategory(transactionId, categoryId, {
        reason: "handmatige wijziging",
        learnFromCounterparty: shouldLearnFromCounterparty,
      });
      if (shouldUpdateCounterparty && tx?.counterparty) {
        await bulkUpdateCategoryByCounterparty(tx.counterparty, categoryId, "all");
      }
      setCategorySheetOpen(false);
      setDraftApplyCategoryToCounterparty(false);
      setDraftLearnCategoryFromCounterparty(false);
      await refreshTransactionSnapshot();
    } catch (e) {
      console.warn("setCategory error", e);
    } finally {
      setSavingCategory(false);
    }
  }, [
    categoryChangeMode,
    draftApplyCategoryToCounterparty,
    draftCategoryId,
    draftLearnCategoryFromCounterparty,
    refreshTransactionSnapshot,
    transactionId,
    tx?.category_id_auto,
    tx?.category_id_user,
    tx?.counterparty,
  ]);

  const handleOpenCategorySheet = React.useCallback(() => {
    blurActiveWebElement();
    const currentCategoryId = tx?.category_id_user || tx?.category_id_auto || null;
    setDraftCategoryId(currentCategoryId);
    setDraftApplyCategoryToCounterparty(false);
    setDraftLearnCategoryFromCounterparty(false);
    setCategoryChangeMode("ai");
    setShowCategoryOptions(false);
    setCategorySearchInput("");
    scrollCategoryGroupIntoView(categorySheetInitialGroupId, currentCategoryId);
    setCategorySheetOpen(true);
  }, [
    blurActiveWebElement,
    categorySheetInitialGroupId,
    scrollCategoryGroupIntoView,
    tx?.category_id_auto,
    tx?.category_id_user,
  ]);

  const handleSelectManualCategoryMode = React.useCallback(() => {
    setCategoryChangeMode("manual");
    const selectedCategoryId = draftCategoryId || effectiveCategoryId;
    const targetGroupId =
      categoryGroups.find((group) =>
        group.leaves.some((cat) => cat.id === selectedCategoryId),
      )?.parent?.id ||
      categorySheetInitialGroupId ||
      "__root";
    scrollCategoryGroupIntoView(targetGroupId, selectedCategoryId);
  }, [
    categoryGroups,
    categorySheetInitialGroupId,
    draftCategoryId,
    effectiveCategoryId,
    scrollCategoryGroupIntoView,
  ]);

  const handleCloseCategorySheet = React.useCallback(() => {
    blurActiveWebElement();
    setCategorySheetOpen(false);
    setCategoryChangeMode("ai");
    setShowCategoryOptions(false);
    setCategorySearchInput("");
    setDraftApplyCategoryToCounterparty(false);
    setDraftLearnCategoryFromCounterparty(false);
  }, [blurActiveWebElement]);

  const handleResetCategoryRule = React.useCallback(async () => {
    if (!transactionId || categoryRuleResetBusy || !categoryRuleMatch) return;
    setCategoryRuleResetBusy(true);
    try {
      const reset = await resetTransactionRuleMatch(transactionId);
      if (!reset) return;
      const detail = await getTransactionDetail(transactionId);
      setTx(detail);
      setCategoryRuleMatch(null);
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
    } catch (error) {
      console.warn("category rule reset error", error);
    } finally {
      setCategoryRuleResetBusy(false);
    }
  }, [categoryRuleMatch, categoryRuleResetBusy, transactionId]);

  const registerCategoryGroupLayout = React.useCallback(
    (groupId: string, y: number) => {
      categoryGroupLayoutYRef.current.set(groupId, y);
      if (
        categoryScrollTargetRef.current?.groupId === groupId &&
        categoryScrollTargetRef.current?.leafId == null
      ) {
        void tryScrollCategoryTarget();
        return;
      }
      if (
        !categorySheetOpen ||
        categorySheetScrolledRef.current ||
        categorySheetExpandedGroupId !== groupId
      ) {
        return;
      }

      categorySheetScrolledRef.current = true;
      requestAnimationFrame(() => {
        categorySheetScrollRef.current?.scrollTo({
          y: Math.max(y - 16, 0),
          animated: false,
        });
      });
    },
    [categorySheetExpandedGroupId, categorySheetOpen, tryScrollCategoryTarget],
  );

  const registerCategoryLeafLayout = React.useCallback(
    (groupId: string, leafId: string, y: number) => {
      categoryLeafLayoutYRef.current.set(`${groupId}:${leafId}`, y);
      if (
        categoryScrollTargetRef.current?.groupId === groupId &&
        categoryScrollTargetRef.current?.leafId === leafId
      ) {
        void tryScrollCategoryTarget();
      }
    },
    [tryScrollCategoryTarget],
  );

  React.useEffect(() => {
    if (!categorySheetOpen) return;
    categorySheetScrolledRef.current = false;
    scrollCategoryGroupIntoView(categorySheetInitialGroupId, effectiveCategoryId);
  }, [
    categorySheetInitialGroupId,
    categorySheetOpen,
    effectiveCategoryId,
    scrollCategoryGroupIntoView,
  ]);

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
  const paymentMethodLabel = resolvePaymentMethodFromLinkedAccount(tx);
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
    <FinanceDetailShell
      title="Transactie"
      onBack={() => router.back()}
      footer={
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
      }
      contentContainerStyle={styles.scrollContent}
      contentMaxStyle={styles.contentMax}
      scrollProps={{ showsVerticalScrollIndicator: false }}
    >
        <FinanceHeroShell
          shellStyle={styles.heroShell}
          innerStyle={styles.heroInner}
          eyebrow="Transactie detail"
          title={tx.counterparty || "Onbekende tegenpartij"}
          subtitle={formatSignedCurrency(tx.amount)}
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
                {categoryAttributionLabel ? (
                  <Text style={styles.categoryAttributionLabel}>
                    {categoryAttributionLabel}
                  </Text>
                ) : null}
              </View>
              <FinanceCircleIconButton
                icon="edit"
                iconColor={FinColors.textPrimary}
                onPress={() => void handleOpenCategorySheet()}
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

        {tx.counterparty ? (
          <View style={styles.historySection}>
            <FinanceTransactionsBlock
              title="Historie"
              items={filteredHistoryItems}
              categoryById={categoryById}
              maxItems={6}
              headerExtra={
                <View style={styles.historyFilterRow}>
                  <TouchableOpacity
                    style={[
                      styles.historyFilterChip,
                      historySameCategorySelected &&
                        styles.historyFilterChipActive,
                      !effectiveCategoryId && styles.historyFilterChipDisabled,
                    ]}
                    onPress={() => setHistoryFilterMode("same_category")}
                    disabled={!effectiveCategoryId}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.historyFilterChipText,
                        historySameCategorySelected &&
                          styles.historyFilterChipTextActive,
                        !effectiveCategoryId &&
                          styles.historyFilterChipTextDisabled,
                      ]}
                    >
                      Zelfde categorie
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.historyFilterChip,
                      historyAllSelected && styles.historyFilterChipActive,
                    ]}
                    onPress={() => setHistoryFilterMode("all")}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.historyFilterChipText,
                        historyAllSelected && styles.historyFilterChipTextActive,
                      ]}
                    >
                      {historyAllLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              }
              onPressItem={(id) =>
                router.push({
                  pathname: "/transactions/[id]",
                  params: { id },
                })
              }
              onPressSeeAll={() =>
                router.push({
                  pathname: "/transactions",
                  params: {
                    counterparty: tx.counterparty || "",
                    categoryKey:
                      historyFilterMode === "same_category"
                        ? effectiveCategory?.key || undefined
                        : undefined,
                  },
                })
              }
              seeAllLabel="Bekijk alles"
              showRunningBalance={false}
              emptyTitle="Geen andere transacties"
              emptyDescription={
                historyFilterMode === "same_category" && effectiveCategory
                  ? `We vonden nog geen andere transacties van ${tx.counterparty} in ${effectiveCategory.name}.`
                  : `We vonden nog geen andere transacties van ${tx.counterparty}.`
              }
            />
          </View>
        ) : null}

        <View style={{ height: 32 }} />
        </View>
      

      <FinanceBottomSheetShell
        visible={categorySheetOpen}
        title="Categorie"
        subtitle="De keuze geldt alleen voor deze transactie."
        onClose={handleCloseCategorySheet}
        bodyStyle={styles.categorySheetBody}
        footerStyle={styles.categorySheetFooter}
        footer={
          <TouchableOpacity
            style={[
              styles.categoryConfirmButton,
              savingCategory && styles.categoryConfirmButtonDisabled,
            ]}
            disabled={savingCategory}
            onPress={() => void handleApplyCategoryChanges()}
          >
            {savingCategory ? (
              <ActivityIndicator color={FinColors.textPrimary} size="small" />
            ) : (
              <Text style={styles.categoryConfirmButtonText}>
                Bevestig wijziging
              </Text>
            )}
          </TouchableOpacity>
        }
      >
        <View style={styles.categorySheetFixed}>
          <Text style={styles.categorySheetHeading}>Hoe wil je aanpassen?</Text>
          <View style={styles.categoryModeSwitchRow}>
            <TouchableOpacity
              style={[
                styles.categoryModeButton,
                categoryChangeMode === "ai" && styles.categoryModeButtonActive,
              ]}
              onPress={() => setCategoryChangeMode("ai")}
            >
              <Text
                style={[
                  styles.categoryModeButtonText,
                  categoryChangeMode === "ai" &&
                    styles.categoryModeButtonTextActive,
                ]}
              >
                Via AI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.categoryModeButton,
                categoryChangeMode === "manual" &&
                  styles.categoryModeButtonActive,
              ]}
              onPress={handleSelectManualCategoryMode}
            >
              <Text
                style={[
                  styles.categoryModeButtonText,
                  categoryChangeMode === "manual" &&
                    styles.categoryModeButtonTextActive,
                ]}
              >
                Handmatig
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.categoryOptionsToggle}
            onPress={() => setShowCategoryOptions((current) => !current)}
            activeOpacity={0.9}
          >
            <Text style={styles.categoryOptionsToggleText}>
              {showCategoryOptions ? "Verberg opties" : "Toon opties"}
            </Text>
          </TouchableOpacity>

          {showCategoryOptions && tx.counterparty ? (
            <FinanceFlatChoiceCard
              title="Ook alle transacties van deze ontvangende partij"
              description="Wijzig meteen bestaande transacties met dezelfde tegenpartij."
              rightSlot={
                <Switch
                  value={draftApplyCategoryToCounterparty}
                  onValueChange={setDraftApplyCategoryToCounterparty}
                  trackColor={{
                    false: FinColors.bgInput,
                    true: FinColors.greenBorder,
                  }}
                  thumbColor={
                    draftApplyCategoryToCounterparty
                      ? FinColors.green
                      : FinColors.textMuted
                  }
                  disabled={savingCategory}
                />
              }
            />
          ) : null}

          {showCategoryOptions && tx.counterparty ? (
            <FinanceFlatChoiceCard
              title="Ook toekomstige transacties hier op mappen"
              description="Maakt een regel op basis van deze tegenpartij voor volgende transacties."
              rightSlot={
                <Switch
                  value={draftLearnCategoryFromCounterparty}
                  onValueChange={setDraftLearnCategoryFromCounterparty}
                  trackColor={{
                    false: FinColors.bgInput,
                    true: FinColors.greenBorder,
                  }}
                  thumbColor={
                    draftLearnCategoryFromCounterparty
                      ? FinColors.green
                      : FinColors.textMuted
                  }
                  disabled={
                    savingCategory ||
                    !tx.counterparty ||
                    isSubjectDrivenCounterparty(tx.counterparty)
                  }
                />
              }
            />
          ) : null}

          {showCategoryOptions && categoryRuleMatch ? (
            <FinanceFlatChoiceCard
              title="Actieve regel"
              description={`${categoryRuleMatch.pattern} → ${categoryRuleMatch.categoryName} • ${categoryRuleMatch.scope === "user" ? "Eigen regel" : "Systeemregel"} • Kans ${Math.round(categoryRuleMatch.confidence * 100)}%`}
              rightSlot={
                categoryRuleMatch.scope === "user" ? (
                  <TouchableOpacity
                    style={[
                      styles.categoryRuleResetButton,
                      categoryRuleResetBusy &&
                        styles.categoryRuleResetButtonDisabled,
                    ]}
                    disabled={categoryRuleResetBusy}
                    onPress={() => void handleResetCategoryRule()}
                  >
                    {categoryRuleResetBusy ? (
                      <ActivityIndicator
                        color={FinColors.textPrimary}
                        size="small"
                      />
                    ) : (
                      <Text style={styles.categoryRuleResetButtonText}>
                        Reset
                      </Text>
                    )}
                  </TouchableOpacity>
                ) : null
              }
            />
          ) : null}

          {categoryChangeMode === "manual" ? (
            <View style={styles.categorySearchWrap}>
              <AppIcon
                name="search"
                size={15}
                color={FinColors.textMuted}
                style={styles.categorySearchIcon}
                variant="outlined"
              />
              <TextInput
                value={categorySearchInput}
                onChangeText={setCategorySearchInput}
                placeholder="Zoek categorie..."
                placeholderTextColor={FinColors.textMuted}
                style={styles.categorySearchInput}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
            </View>
          ) : null}
        </View>

        <ScrollView
          ref={categorySheetScrollRef}
          style={styles.categorySheetScroll}
          contentContainerStyle={styles.categorySheetContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          {categoryChangeMode === "manual" && filteredCategoryGroups.length ? (
            filteredCategoryGroups.map((group) => {
              const groupKey = group.parent?.id || "__root";
              const isExpanded = categorySheetExpandedGroupId === groupKey;
              const selectedLeaf = group.leaves.find(
                (cat) => cat.id === draftCategoryId,
              );
              const representativeLeaf = selectedLeaf || group.leaves[0] || null;
              const groupIconName = representativeLeaf
                ? (resolveTransactionCategoryIconName(
                    {
                      category_id_auto: representativeLeaf.id,
                      category_id_user: null,
                    },
                    categoryById,
                  ) as AppIconName)
                : ("folder" as AppIconName);

              return (
                <View
                  key={groupKey}
                  onLayout={(event) =>
                    registerCategoryGroupLayout(groupKey, event.nativeEvent.layout.y)
                  }
                  style={styles.categoryGroupWrap}
                >
                  <FinanceCategoryGroupCard
                    title={group.parent?.name ?? "Overige"}
                    subtitle={
                      selectedLeaf
                        ? `${selectedLeaf.name} geselecteerd`
                        : `${group.leaves.length} categorieën`
                    }
                    selected={Boolean(selectedLeaf)}
                    expanded={isExpanded}
                    iconName={groupIconName}
                    onToggle={() =>
                      setCategorySheetExpandedGroupId((current) =>
                        current === groupKey ? null : groupKey,
                      )
                    }
                  >
                    {group.leaves.map((cat) => {
                      const isSelected = draftCategoryId === cat.id;
                      const leafIconName = resolveTransactionCategoryIconName(
                        {
                          category_id_auto: cat.id,
                          category_id_user: null,
                        },
                        categoryById,
                      ) as AppIconName;

                      return (
                        <View
                          key={cat.id}
                          onLayout={(event) =>
                            registerCategoryLeafLayout(
                              groupKey,
                              cat.id,
                              event.nativeEvent.layout.y,
                            )
                          }
                        >
                          <FinanceCategoryLeafRow
                            label={cat.name}
                            selected={isSelected}
                            iconName={leafIconName}
                            disabled={savingCategory}
                            onPress={() => {
                              setDraftCategoryId(cat.id);
                              setCategorySheetExpandedGroupId(groupKey);
                            }}
                          />
                        </View>
                      );
                    })}
                  </FinanceCategoryGroupCard>
                </View>
              );
            })
          ) : (
            <Text style={styles.categorySheetEmptyText}>
              {categoryChangeMode === "ai"
                ? "Via AI is uitgevoerd. Kies 'Handmatig' om zelf een categorie te selecteren."
                : normalizedCategorySearch
                  ? "Geen categorie gevonden voor je zoekopdracht."
                : "Geen categorieën beschikbaar."}
            </Text>
          )}
        </ScrollView>
      </FinanceBottomSheetShell>

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
    </FinanceDetailShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 0,
    paddingBottom: 132,
    gap: 32,
  },
  contentMax: {
    paddingHorizontal: 16,
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
    borderBottomColor: FinColors.borderSubtle,
  },
  heroInner: {
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
    gap: 4,
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
  categoryAttributionLabel: {
    color: FinColors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
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
    backgroundColor: FinColors.bgCard,
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
    backgroundColor: FinColors.bgCard,
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
  historySection: {
    gap: 10,
  },
  historyFilterRow: {
    flexDirection: "row",
    gap: 8,
  },
  historyFilterChip: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  historyFilterChipActive: {
    backgroundColor: FinColors.yellowSoft,
    borderColor: FinColors.warningBorder,
  },
  historyFilterChipDisabled: {
    opacity: 0.62,
  },
  historyFilterChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  historyFilterChipTextActive: {
    color: FinColors.textPrimary,
  },
  historyFilterChipTextDisabled: {
    color: FinColors.textMuted,
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
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 20,
    gap: 12,
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
    backgroundColor: FinColors.overlayStrong,
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

  // Category sheet
  categorySheetBody: {
    flex: 1,
    minHeight: 0,
    marginTop: 16,
    paddingBottom: 0,
    gap: 12,
  },
  categorySheetFixed: {
    gap: 10,
  },
  categorySheetHeading: {
    color: FinColors.textPrimary,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    paddingHorizontal: 4,
  },
  categoryModeSwitchRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 4,
  },
  categoryModeButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  categoryModeButtonActive: {
    backgroundColor: FinColors.yellow,
    borderColor: FinColors.yellow,
  },
  categoryModeButtonText: {
    color: FinColors.textSecondary,
    fontSize: 14,
    fontWeight: "700",
  },
  categoryModeButtonTextActive: {
    color: FinColors.textPrimary,
  },
  categoryOptionsToggle: {
    alignSelf: "flex-start",
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryOptionsToggleText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  categorySheetScroll: {
    flex: 1,
    minHeight: 0,
  },
  categorySheetContent: {
    gap: 10,
    paddingBottom: 10,
  },
  categoryGroupWrap: {
    gap: 8,
  },
  categorySearchWrap: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    justifyContent: "center",
  },
  categorySearchIcon: {
    position: "absolute",
    left: 12,
    top: 12,
  },
  categorySearchInput: {
    paddingLeft: 36,
    paddingRight: 12,
    paddingVertical: 10,
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textPrimary,
  },
  categorySheetFooter: {
    marginTop: 16,
  },
  categoryConfirmButton: {
    minHeight: 56,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  categoryConfirmButtonDisabled: {
    opacity: 0.75,
  },
  categoryConfirmButtonText: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  categoryAiButton: {
    minWidth: 84,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 14,
  },
  categoryAiButtonDisabled: {
    opacity: 0.75,
  },
  categoryAiButtonText: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "800",
  },
  categoryRuleResetButton: {
    minWidth: 84,
    height: 40,
    borderRadius: 999,
    backgroundColor: FinColors.warningBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FinColors.warningBorder,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  categoryRuleResetButtonDisabled: {
    opacity: 0.74,
  },
  categoryRuleResetButtonText: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  categorySheetEmptyText: {
    color: FinColors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
  },

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
