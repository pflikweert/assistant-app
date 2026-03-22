import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { normalizePattern } from "@/services/categorization-repository";
import {
    createSubscriptionProfile,
    deleteSubscriptionProfile,
    deleteSubscriptionProfileRule,
    getSubscriptionDashboardData,
    linkTransactionsToSubscription,
    linkTransactionToSubscription,
    listSubscriptionRuleValidationCandidates,
    markTransactionAsNotSubscription,
    setSubscriptionProfileActive,
    updateSubscriptionProfile,
    upsertSubscriptionProfileRule,
} from "@/services/subscriptions";
import type {
    SubscriptionBillingCycle,
    SubscriptionProfile,
    SubscriptionProfileRule,
    SubscriptionProfileRuleType,
    SubscriptionProviderHint,
    SubscriptionQueueItem,
    SubscriptionValidationCandidate,
} from "@/types/categorization";
import { AppIcon } from "@/components/ui/app-icon";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Modal,
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

const BILLING_CYCLE_OPTIONS: {
  value: SubscriptionBillingCycle;
  label: string;
}[] = [
  { value: "monthly", label: "Maandelijks" },
  { value: "quarterly", label: "Per kwartaal" },
  { value: "yearly", label: "Jaarlijks" },
];

const PROVIDER_HINT_OPTIONS: {
  value: SubscriptionProviderHint;
  label: string;
}[] = [
  { value: "paypal", label: "PayPal" },
  { value: "google_play", label: "Google Play" },
  { value: "apple", label: "Apple" },
  { value: "klarna", label: "Klarna/Riverty" },
  { value: "other", label: "Overig" },
];

function toUtcDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getCurrentMonthBounds() {
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const monthEndExclusive = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return {
    monthStartIso: toUtcDateIso(monthStart),
    monthEndIso: toUtcDateIso(monthEndExclusive),
  };
}

function parseNumberOrNull(value: string): number | null {
  const normalized = String(value || "")
    .trim()
    .replace(/,/g, ".")
    .replace(/[^0-9.-]/g, "");
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseIntegerOrNull(value: string): number | null {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function resolveAutomaticAmountTolerance(expectedAmount: number | null): number {
  if (expectedAmount == null || expectedAmount <= 0) return 0;
  return Math.min(Math.max(Math.round(expectedAmount * 0.05), 1), 5);
}

function getDayOfMonthFromIso(value: string): number | null {
  const date = new Date(`${String(value || "").slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCDate();
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function extractSubject(details: string): string {
  const value = String(details || "");
  const subject = value.split("|")[0]?.trim() || value.trim();
  return subject || "Onbekende omschrijving";
}

function toTitleCaseWords(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function deriveProfileNameFromQueueItem(item: SubscriptionQueueItem): string {
  const subject = extractSubject(item.details);
  const withoutLeadingReference = subject.replace(/^\d+[\/-]*/, "").trim();
  const firstPart =
    withoutLeadingReference.split("|")[0] || withoutLeadingReference;
  const providerTrimmed = firstPart
    .replace(/^paypal\s*/i, "")
    .replace(/^google\s*play\s*/i, "")
    .replace(/^apple\s*/i, "")
    .replace(/^klarna\s*/i, "")
    .trim();

  const starPart = providerTrimmed.includes("*")
    ? providerTrimmed
        .split("*")
        .map((part) => part.trim())
        .find((part) => /[a-zA-Z]{3,}/.test(part)) || providerTrimmed
    : providerTrimmed;

  const cleaned = starPart
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b(www|com|nl|eu)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const compact = cleaned || subject.replace(/\s+/g, " ").trim();
  if (!compact) return "Nieuw abonnement";
  const titled = toTitleCaseWords(compact);
  if (titled.length <= 40) return titled;
  return titled.slice(0, 40).trim();
}

function getProviderHintLabel(
  provider: SubscriptionProviderHint | null,
): string {
  if (!provider) return "Onbekend";
  return (
    PROVIDER_HINT_OPTIONS.find((option) => option.value === provider)?.label ||
    provider
  );
}

function normalizeProviderHintParam(
  value?: string | string[],
): SubscriptionProviderHint | null {
  const raw = normalizeRouteParam(value);
  if (
    raw === "paypal" ||
    raw === "google_play" ||
    raw === "apple" ||
    raw === "klarna" ||
    raw === "other"
  ) {
    return raw;
  }
  return null;
}

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  if (error && typeof error === "object") {
    const details = String((error as { details?: unknown }).details || "").trim();
    if (details) return details;
    const hint = String((error as { hint?: unknown }).hint || "").trim();
    if (hint) return hint;
  }
  return fallback;
}

type RuleDraft = {
  pattern: string;
  patternType: SubscriptionProfileRuleType;
};

type AmountMatchMode = "fixed" | "flexible";

type EditableRule = {
  key: string;
  id?: string;
  pattern: string;
  patternType: SubscriptionProfileRuleType;
};

function getDefaultRuleDraft(): RuleDraft {
  return {
    pattern: "",
    patternType: "details_contains",
  };
}

const GENERIC_RULE_SKIP_PATTERNS = [
  "paypal",
  "google play",
  "apple",
  "klarna",
  "riverty",
  "payment provider",
  "merchant of record",
];

function isUsefulRulePattern(value: string): boolean {
  const normalized = normalizePattern(value);
  if (!normalized || normalized.length < 3) return false;
  return !GENERIC_RULE_SKIP_PATTERNS.includes(normalized);
}

function createEditableRule(
  pattern: string,
  patternType: SubscriptionProfileRuleType,
  id?: string,
): EditableRule | null {
  const trimmed = String(pattern || "").trim();
  if (!isUsefulRulePattern(trimmed)) return null;
  return {
    key: `${id || "draft"}:${patternType}:${normalizePattern(trimmed)}`,
    id,
    pattern: trimmed,
    patternType,
  };
}

function dedupeEditableRules(rules: EditableRule[]): EditableRule[] {
  const seen = new Set<string>();
  const next: EditableRule[] = [];
  for (const rule of rules) {
    const dedupeKey = `${rule.patternType}:${normalizePattern(rule.pattern)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    next.push(rule);
  }
  return next;
}

function hasConflictingProfileName(
  profiles: SubscriptionProfile[],
  nextName: string,
  editingProfileId?: string | null,
): boolean {
  const normalizedName = normalizePattern(nextName);
  if (!normalizedName) return false;
  return profiles.some(
    (profile) =>
      profile.id !== editingProfileId && profile.normalizedName === normalizedName,
  );
}

function buildInitialRulesFromQueueItem(
  queueItem: SubscriptionQueueItem,
  fallbackName: string,
): EditableRule[] {
  const counterparty = String(queueItem.counterparty || "").trim();
  const primaryRule =
    createEditableRule(counterparty, "counterparty_contains") ||
    createEditableRule(fallbackName, "details_contains");

  return primaryRule ? [primaryRule] : [];
}

export default function SubscriptionsScreen() {
  const params = useLocalSearchParams<{
    profileId?: string | string[];
    createFromTransactionId?: string | string[];
    createFromTransactionDate?: string | string[];
    createFromTransactionCounterparty?: string | string[];
    createFromTransactionDetails?: string | string[];
    createFromTransactionAmount?: string | string[];
    createFromTransactionProvider?: string | string[];
    createSetCategoryOnLink?: string | string[];
  }>();
  const focusProfileId = React.useMemo(
    () => normalizeRouteParam(params.profileId),
    [params.profileId],
  );
  const createFromTransaction = React.useMemo<SubscriptionQueueItem | null>(() => {
    const transactionId = normalizeRouteParam(params.createFromTransactionId);
    const date = normalizeRouteParam(params.createFromTransactionDate);
    const details = normalizeRouteParam(params.createFromTransactionDetails);
    const amountRaw = normalizeRouteParam(params.createFromTransactionAmount);

    if (!transactionId || !date || !details) return null;

    const amount = Number.parseFloat(String(amountRaw || ""));
    if (!Number.isFinite(amount)) return null;

    return {
      transactionId,
      date,
      counterparty:
        normalizeRouteParam(params.createFromTransactionCounterparty) || null,
      details,
      amount,
      providerDetected: normalizeProviderHintParam(
        params.createFromTransactionProvider,
      ),
      suggestions: [],
    };
  }, [
    params.createFromTransactionAmount,
    params.createFromTransactionCounterparty,
    params.createFromTransactionDate,
    params.createFromTransactionDetails,
    params.createFromTransactionId,
    params.createFromTransactionProvider,
  ]);
  const createSetCategoryOnLinkParam = React.useMemo(
    () => normalizeRouteParam(params.createSetCategoryOnLink),
    [params.createSetCategoryOnLink],
  );
  const router = useRouter();
  const handledFocusProfileIdRef = React.useRef<string | null>(null);
  const handledCreateTransactionIdRef = React.useRef<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [deletingProfileId, setDeletingProfileId] = React.useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [busyTransactionIds, setBusyTransactionIds] = React.useState<string[]>(
    [],
  );

  const [profiles, setProfiles] = React.useState<SubscriptionProfile[]>([]);
  const [queueItems, setQueueItems] = React.useState<SubscriptionQueueItem[]>(
    [],
  );
  const [rulesByProfileId, setRulesByProfileId] = React.useState<
    Record<string, SubscriptionProfileRule[]>
  >({});

  const [setCategoryOnLink, setSetCategoryOnLink] = React.useState(true);
  const [chooseProfileTx, setChooseProfileTx] =
    React.useState<SubscriptionQueueItem | null>(null);

  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] =
    React.useState<SubscriptionProfile | null>(null);
  const [profilePendingDelete, setProfilePendingDelete] =
    React.useState<SubscriptionProfile | null>(null);
  const [createForTransaction, setCreateForTransaction] =
    React.useState<SubscriptionQueueItem | null>(null);

  const [profileName, setProfileName] = React.useState("");
  const [billingCycle, setBillingCycle] =
    React.useState<SubscriptionBillingCycle>("monthly");
  const [expectedAmountInput, setExpectedAmountInput] = React.useState("");
  const [amountMatchMode, setAmountMatchMode] =
    React.useState<AmountMatchMode>("fixed");
  const [expectedDayInput, setExpectedDayInput] = React.useState("");
  const [providerHint, setProviderHint] =
    React.useState<SubscriptionProviderHint | null>(null);
  const [profileIsActive, setProfileIsActive] = React.useState(true);
  const [profileFormError, setProfileFormError] = React.useState<string | null>(
    null,
  );
  const [modalRuleDraft, setModalRuleDraft] = React.useState<RuleDraft>(
    getDefaultRuleDraft(),
  );
  const [modalRules, setModalRules] = React.useState<EditableRule[]>([]);
  const [validationCandidates, setValidationCandidates] = React.useState<
    SubscriptionValidationCandidate[]
  >([]);
  const [selectedValidationCandidateIds, setSelectedValidationCandidateIds] =
    React.useState<string[]>([]);
  const [validationLoading, setValidationLoading] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(
    null,
  );
  const activeProfilesCount = React.useMemo(
    () => profiles.filter((profile) => profile.isActive).length,
    [profiles],
  );
  const suggestedQueueCount = React.useMemo(
    () => queueItems.filter((item) => item.suggestions.length > 0).length,
    [queueItems],
  );
  const summaryHeadline =
    activeProfilesCount > 0
      ? `${activeProfilesCount} actief profiel${activeProfilesCount === 1 ? "" : "en"} houden je terugkerende betalingen centraal.`
      : "Zet je terugkerende betalingen via PayPal, Klarna of Apple om naar beheerde abonnementen.";

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { monthStartIso, monthEndIso } = getCurrentMonthBounds();
      const {
        profiles: loadedProfiles,
        queueItems,
        rulesByProfileId,
      } = await getSubscriptionDashboardData(monthStartIso, monthEndIso);

      setProfiles(loadedProfiles);
      setQueueItems(queueItems);
      setRulesByProfileId(rulesByProfileId);
    } catch (error) {
      console.warn("[subscriptions] load error", error);
      const message =
        error instanceof Error ? error.message : "Kon abonnementen niet laden.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetProfileForm = React.useCallback(() => {
    setProfileName("");
    setBillingCycle("monthly");
    setExpectedAmountInput("");
    setAmountMatchMode("fixed");
    setExpectedDayInput("");
    setProviderHint(null);
    setProfileIsActive(true);
    setProfileFormError(null);
    setModalRuleDraft(getDefaultRuleDraft());
    setModalRules([]);
    setValidationCandidates([]);
    setSelectedValidationCandidateIds([]);
    setValidationError(null);
    setValidationLoading(false);
  }, []);

  const openCreateProfileModal = React.useCallback(
    (queueItem?: SubscriptionQueueItem) => {
      resetProfileForm();
      setEditingProfile(null);
      setCreateForTransaction(queueItem || null);
      if (queueItem) {
        const nextName = deriveProfileNameFromQueueItem(queueItem);
        setProfileName(nextName);
        setBillingCycle("monthly");
        setProviderHint(queueItem.providerDetected || null);
        setExpectedAmountInput(String(Math.abs(queueItem.amount)));
        setAmountMatchMode("fixed");
        const detectedDay = getDayOfMonthFromIso(queueItem.date);
        setExpectedDayInput(detectedDay == null ? "" : String(detectedDay));
        setModalRules(buildInitialRulesFromQueueItem(queueItem, nextName));
      }
      setProfileModalOpen(true);
    },
    [resetProfileForm],
  );

  const openEditProfileModal = React.useCallback(
    (profile: SubscriptionProfile) => {
      setEditingProfile(profile);
      setCreateForTransaction(null);
      setProfileName(profile.name);
      setBillingCycle(profile.billingCycle);
      setExpectedAmountInput(
        profile.expectedAmount == null ? "" : String(profile.expectedAmount),
      );
      setAmountMatchMode(profile.amountTolerance > 0 ? "flexible" : "fixed");
      setExpectedDayInput(
        profile.expectedDayOfMonth == null
          ? ""
          : String(profile.expectedDayOfMonth),
      );
      setProviderHint(profile.providerHint);
      setProfileIsActive(profile.isActive);
      setModalRuleDraft(getDefaultRuleDraft());
      setModalRules(
        (rulesByProfileId[profile.id] || [])
          .map((rule) =>
            createEditableRule(rule.pattern, rule.patternType, rule.id),
          )
          .filter((rule): rule is EditableRule => Boolean(rule)),
      );
      setValidationCandidates([]);
      setSelectedValidationCandidateIds([]);
      setValidationError(null);
      setProfileFormError(null);
      setProfileModalOpen(true);
    },
    [rulesByProfileId],
  );

  const toggleValidationCandidate = React.useCallback(
    (transactionId: string) => {
      setSelectedValidationCandidateIds((current) => {
        if (current.includes(transactionId)) {
          return current.filter((id) => id !== transactionId);
        }
        return [...current, transactionId];
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!profileModalOpen) {
      setValidationCandidates([]);
      setSelectedValidationCandidateIds([]);
      setValidationError(null);
      setValidationLoading(false);
      return;
    }

    const sourceDate = createForTransaction?.date || null;
    const sourceTransactionId = createForTransaction?.transactionId || null;
    const trimmedName = String(profileName || "").trim();
    const expectedAmount =
      parseNumberOrNull(expectedAmountInput) ??
      (createForTransaction ? Math.abs(createForTransaction.amount) : null);
    const amountTolerance =
      amountMatchMode === "fixed"
        ? 0
        : resolveAutomaticAmountTolerance(expectedAmount);
    const expectedDay =
      parseIntegerOrNull(expectedDayInput) ??
      (createForTransaction ? getDayOfMonthFromIso(createForTransaction.date) : null);
    const effectiveRules = modalRules.map((rule) => ({
      pattern: rule.pattern,
      patternType: rule.patternType,
    }));

    if (
      billingCycle !== "monthly" ||
      (!trimmedName && effectiveRules.length === 0 && expectedAmount == null)
    ) {
      setValidationCandidates([]);
      setSelectedValidationCandidateIds([]);
      setValidationError(null);
      setValidationLoading(false);
      return;
    }

    let cancelled = false;
    setValidationLoading(true);
    setValidationError(null);

    void listSubscriptionRuleValidationCandidates({
      profileId: editingProfile?.id || null,
      sourceTransactionId,
      sourceDate,
      name: trimmedName,
      billingCycle,
      expectedAmount,
      amountTolerance,
      expectedDayOfMonth: expectedDay,
      providerHint: providerHint || createForTransaction?.providerDetected || null,
      rules: effectiveRules,
      maxCandidates: 8,
    })
      .then((candidates) => {
        if (cancelled) return;
        setValidationCandidates(candidates);
        setSelectedValidationCandidateIds(
          candidates.map((candidate) => candidate.transactionId),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Kon vorige transacties niet valideren.";
        setValidationError(message);
        setValidationCandidates([]);
        setSelectedValidationCandidateIds([]);
      })
      .finally(() => {
        if (cancelled) return;
        setValidationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    billingCycle,
    createForTransaction,
    editingProfile,
    amountMatchMode,
    expectedAmountInput,
    expectedDayInput,
    modalRules,
    profileModalOpen,
    profileName,
    providerHint,
  ]);

  React.useEffect(() => {
    if (!focusProfileId || loading) return;
    if (handledFocusProfileIdRef.current === focusProfileId) return;

    const targetProfile = profiles.find(
      (profile) => profile.id === focusProfileId,
    );
    if (!targetProfile) return;

    handledFocusProfileIdRef.current = focusProfileId;
    openEditProfileModal(targetProfile);
  }, [focusProfileId, loading, openEditProfileModal, profiles]);

  React.useEffect(() => {
    if (!createFromTransaction || loading) return;
    if (handledCreateTransactionIdRef.current === createFromTransaction.transactionId) {
      return;
    }

    handledCreateTransactionIdRef.current = createFromTransaction.transactionId;
    if (createSetCategoryOnLinkParam) {
      setSetCategoryOnLink(createSetCategoryOnLinkParam !== "0");
    }
    openCreateProfileModal(createFromTransaction);
  }, [
    createFromTransaction,
    createSetCategoryOnLinkParam,
    loading,
    openCreateProfileModal,
  ]);

  const handleAddModalRule = React.useCallback(() => {
    const rule = createEditableRule(
      modalRuleDraft.pattern,
      modalRuleDraft.patternType,
    );
    if (!rule) {
      setProfileFormError(
        "Voeg een bruikbaar woord of naam toe voor de herkenningsregel.",
      );
      return;
    }
    setModalRules((current) => dedupeEditableRules([...current, rule]));
    setModalRuleDraft(getDefaultRuleDraft());
    setProfileFormError(null);
  }, [modalRuleDraft.pattern, modalRuleDraft.patternType]);

  const handleRemoveModalRule = React.useCallback((ruleKey: string) => {
    setModalRules((current) => current.filter((rule) => rule.key !== ruleKey));
  }, []);

  const handleSaveProfile = React.useCallback(async () => {
    const trimmedName = String(profileName || "").trim();
    if (!trimmedName) {
      setProfileFormError("Voer een naam voor het abonnement in.");
      return;
    }

    const expectedDay =
      String(expectedDayInput || "").trim() === ""
        ? null
        : parseIntegerOrNull(expectedDayInput);
    if (
      String(expectedDayInput || "").trim() !== "" &&
      (expectedDay == null || expectedDay < 1 || expectedDay > 31)
    ) {
      setProfileFormError("Vul een geldige dag van de maand in tussen 1 en 31.");
      return;
    }

    if (
      hasConflictingProfileName(
        profiles,
        trimmedName,
        editingProfile ? editingProfile.id : null,
      )
    ) {
      setProfileFormError(
        "Er bestaat al een abonnement met deze naam. Geef dit profiel een eigen naam, bijvoorbeeld de dienstnaam.",
      );
      return;
    }

    setSavingProfile(true);
    setErrorMessage(null);
    setProfileFormError(null);

    try {
      const expectedAmount = parseNumberOrNull(expectedAmountInput);
      const autoTolerance =
        amountMatchMode === "fixed"
          ? 0
          : resolveAutomaticAmountTolerance(expectedAmount);
      const existingProfileRules = editingProfile
        ? rulesByProfileId[editingProfile.id] || []
        : [];

      let savedProfile: SubscriptionProfile;
      if (editingProfile) {
        savedProfile = await updateSubscriptionProfile(editingProfile.id, {
          name: trimmedName,
          billingCycle,
          expectedAmount,
          amountTolerance: autoTolerance,
          expectedDayOfMonth: expectedDay,
          providerHint,
          isActive: profileIsActive,
        });
      } else {
        savedProfile = await createSubscriptionProfile({
          name: trimmedName,
          billingCycle,
          expectedAmount,
          amountTolerance: autoTolerance,
          expectedDayOfMonth: expectedDay,
          providerHint,
          isActive: profileIsActive,
        });
      }

      if (editingProfile) {
        const keptRuleIds = new Set(
          modalRules
            .map((rule) => rule.id)
            .filter((ruleId): ruleId is string => Boolean(ruleId)),
        );

        for (const existingRule of existingProfileRules) {
          if (!keptRuleIds.has(existingRule.id)) {
            await deleteSubscriptionProfileRule(existingRule.id);
          }
        }
      }

      for (const rule of modalRules) {
        if (rule.id) continue;
        await upsertSubscriptionProfileRule({
          subscriptionProfileId: savedProfile.id,
          pattern: rule.pattern,
          patternType: rule.patternType,
        });
      }

      if (createForTransaction) {
        await linkTransactionToSubscription({
          transactionId: createForTransaction.transactionId,
          subscriptionProfileId: savedProfile.id,
          confidence: 1,
          notes: "nieuw profiel vanuit abonnementeninbox",
          setCategoryToSubscriptions: setCategoryOnLink,
        });
      }

      if (selectedValidationCandidateIds.length > 0) {
        await linkTransactionsToSubscription({
          transactionIds: selectedValidationCandidateIds.filter(
            (id) => id !== createForTransaction?.transactionId,
          ),
          subscriptionProfileId: savedProfile.id,
          confidence: 1,
          notes: editingProfile
            ? "historische koppeling na profielupdate"
            : "historische koppeling vanuit abonnementenprofiel",
          setCategoryToSubscriptions: setCategoryOnLink,
        });
      }

      setProfileModalOpen(false);
      setEditingProfile(null);
      setCreateForTransaction(null);
      await loadData();
    } catch (error) {
      console.warn("[subscriptions] save profile error", error);
      const rawMessage = getErrorMessage(error, "Kon profiel niet opslaan.");
      const normalizedMessage = rawMessage.toLowerCase();
      const message =
        normalizedMessage.includes("subscription_profiles_user_plan_name_unique") ||
        normalizedMessage.includes("duplicate key value") ||
        normalizedMessage.includes("normalized_name")
          ? "Er bestaat al een abonnement met deze naam. Geef dit profiel een eigen naam, bijvoorbeeld de dienstnaam."
          : normalizedMessage.includes("subscription_profile_rules") &&
              normalizedMessage.includes("duplicate")
            ? "Deze herkenningsregel bestaat al voor dit abonnement."
          : rawMessage;
      setProfileFormError(message);
      setErrorMessage(message);
    } finally {
      setSavingProfile(false);
    }
  }, [
    billingCycle,
    createForTransaction,
    editingProfile,
    amountMatchMode,
    expectedAmountInput,
    expectedDayInput,
    loadData,
    modalRules,
    profileIsActive,
    profileName,
    providerHint,
    profiles,
    rulesByProfileId,
    selectedValidationCandidateIds,
    setCategoryOnLink,
  ]);

  const handleToggleProfileActive = React.useCallback(
    async (profile: SubscriptionProfile, nextValue: boolean) => {
      try {
        await setSubscriptionProfileActive(profile.id, nextValue);
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] toggle active error", error);
        const message =
          error instanceof Error
            ? error.message
            : "Kon profielstatus niet aanpassen.";
        setErrorMessage(message);
      }
    },
    [loadData],
  );

  const handleDeleteProfile = React.useCallback(
    async (profile: SubscriptionProfile) => {
      setDeletingProfileId(profile.id);
      setErrorMessage(null);
      try {
        await deleteSubscriptionProfile(profile.id);
        setProfilePendingDelete(null);
        if (editingProfile?.id === profile.id) {
          setProfileModalOpen(false);
          setEditingProfile(null);
        }
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] delete profile error", error);
        const message =
          error instanceof Error
            ? error.message
            : "Kon abonnement niet verwijderen.";
        setErrorMessage(message);
      } finally {
        setDeletingProfileId(null);
      }
    },
    [editingProfile?.id, loadData],
  );

  const updateBusyTransaction = React.useCallback(
    (transactionId: string, isBusy: boolean) => {
      setBusyTransactionIds((current) => {
        if (isBusy) {
          if (current.includes(transactionId)) return current;
          return [...current, transactionId];
        }
        return current.filter((id) => id !== transactionId);
      });
    },
    [],
  );

  const handleLinkTransaction = React.useCallback(
    async (
      transaction: SubscriptionQueueItem,
      subscriptionProfileId: string,
      confidence?: number,
    ) => {
      updateBusyTransaction(transaction.transactionId, true);
      setErrorMessage(null);
      try {
        await linkTransactionToSubscription({
          transactionId: transaction.transactionId,
          subscriptionProfileId,
          confidence: confidence ?? 1,
          notes: "gekoppeld vanuit abonnementeninbox",
          setCategoryToSubscriptions: setCategoryOnLink,
        });
        setChooseProfileTx(null);
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] link transaction error", error);
        const message =
          error instanceof Error
            ? error.message
            : "Kon transactie niet koppelen.";
        setErrorMessage(message);
      } finally {
        updateBusyTransaction(transaction.transactionId, false);
      }
    },
    [loadData, setCategoryOnLink, updateBusyTransaction],
  );

  const handleMarkNotSubscription = React.useCallback(
    async (transaction: SubscriptionQueueItem) => {
      updateBusyTransaction(transaction.transactionId, true);
      setErrorMessage(null);
      try {
        await markTransactionAsNotSubscription(
          transaction.transactionId,
          "handmatig gemarkeerd als geen abonnement",
        );
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] mark ignored error", error);
        const message =
          error instanceof Error
            ? error.message
            : "Kon transactie niet negeren.";
        setErrorMessage(message);
      } finally {
        updateBusyTransaction(transaction.transactionId, false);
      }
    },
    [loadData, updateBusyTransaction],
  );

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Abonnementen</Text>
        <HeaderDropdownMenu />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={FinColors.green} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Beheer</Text>
            <Text style={styles.heroTitle}>{summaryHeadline}</Text>
            <Text style={styles.heroCopy}>
              Houd profielen, aliases en transactiekoppelingen op een plek, zodat
              terugkerende betalingen via betaaldiensten sneller opvallen.
            </Text>
            <View style={styles.heroMetricsRow}>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>Actieve profielen</Text>
                <Text style={styles.heroMetricValue}>{activeProfilesCount}</Text>
              </View>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>Te koppelen betalingen</Text>
                <Text style={styles.heroMetricValue}>{queueItems.length}</Text>
              </View>
              <View style={styles.heroMetricCard}>
                <Text style={styles.heroMetricLabel}>Met suggestie</Text>
                <Text style={styles.heroMetricValue}>{suggestedQueueCount}</Text>
              </View>
            </View>
            {focusProfileId ? (
              <Text style={styles.heroHint}>
                Geopend vanuit een transactie. Controleer hier de koppeling of
                maak direct een nieuw profiel.
              </Text>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Abonnementprofielen</Text>
              <TouchableOpacity
                style={styles.smallActionBtn}
                onPress={() => openCreateProfileModal()}
              >
                <Text style={styles.smallActionBtnText}>Nieuw profiel</Text>
              </TouchableOpacity>
            </View>

            {profiles.length === 0 ? (
              <Text style={styles.mutedText}>
                Nog geen abonnementen ingesteld. Voeg een profiel toe om
                terugkerende betalingen te koppelen.
              </Text>
            ) : (
              profiles.map((profile) => {
                return (
                  <View key={profile.id} style={styles.profileCard}>
                    <View style={styles.profileHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.profileName}>{profile.name}</Text>
                        <Text style={styles.profileMeta}>
                          {BILLING_CYCLE_OPTIONS.find(
                            (option) => option.value === profile.billingCycle,
                          )?.label || "Maandelijks"}
                          {profile.expectedAmount != null
                            ? ` · ${euroFormatter.format(profile.expectedAmount)}`
                            : ""}
                        </Text>
                      </View>
                      <Switch
                        value={profile.isActive}
                        onValueChange={(value) =>
                          void handleToggleProfileActive(profile, value)
                        }
                        trackColor={{
                          false: FinColors.bgElevated,
                          true: FinColors.greenBorder,
                        }}
                        thumbColor={
                          profile.isActive
                            ? FinColors.green
                            : FinColors.textMuted
                        }
                      />
                    </View>

                    <View style={styles.profileActionsRow}>
                      <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() => openEditProfileModal(profile)}
                      >
                        <Text style={styles.ghostBtnText}>Bewerk</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.ghostBtn, styles.ghostDangerBtn]}
                        onPress={() => setProfilePendingDelete(profile)}
                        disabled={deletingProfileId === profile.id}
                      >
                        {deletingProfileId === profile.id ? (
                          <ActivityIndicator
                            size="small"
                            color={FinColors.red}
                          />
                        ) : (
                          <>
                            <AppIcon
                              name="delete-outline"
                              size={15}
                              color={FinColors.red}
                              variant="outlined"
                            />
                            <Text
                              style={[
                                styles.ghostBtnText,
                                styles.ghostDangerBtnText,
                              ]}
                            >
                              Verwijder
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Nog te koppelen betalingen</Text>
              <TouchableOpacity
                style={styles.smallActionBtn}
                onPress={() => void loadData()}
              >
                <Text style={styles.smallActionBtnText}>Vernieuwen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>
                Zet categorie op abonnementen
              </Text>
              <Switch
                value={setCategoryOnLink}
                onValueChange={setSetCategoryOnLink}
                trackColor={{
                  false: FinColors.bgElevated,
                  true: FinColors.greenBorder,
                }}
                thumbColor={
                  setCategoryOnLink ? FinColors.green : FinColors.textMuted
                }
              />
            </View>

            {queueItems.length === 0 ? (
              <Text style={styles.mutedText}>
                Geen openstaande betalingen via PayPal, Klarna, Apple of een
                andere betaaldienst zonder abonnementskoppeling in deze maand.
              </Text>
            ) : (
              queueItems.map((item) => {
                const topSuggestion = item.suggestions[0] || null;
                const isBusy = busyTransactionIds.includes(item.transactionId);
                return (
                  <View key={item.transactionId} style={styles.queueCard}>
                    <View style={styles.queueHeaderRow}>
                      <Text style={styles.queueDate}>
                        {formatDateLabel(item.date)}
                      </Text>
                      <Text style={styles.queueAmount}>
                        -{euroFormatter.format(Math.abs(item.amount))}
                      </Text>
                    </View>
                    <Text style={styles.queueCounterparty} numberOfLines={1}>
                      {item.counterparty || "Onbekende tegenpartij"}
                    </Text>
                    <Text style={styles.queueSubject} numberOfLines={2}>
                      {extractSubject(item.details)}
                    </Text>

                    {topSuggestion ? (
                      <View style={styles.suggestionBox}>
                        <Text style={styles.suggestionTitle}>
                          Top suggestie
                        </Text>
                        <Text style={styles.suggestionValue}>
                          {topSuggestion.subscriptionName} ·{" "}
                          {Math.round(topSuggestion.confidence * 100)}% (
                          {topSuggestion.confidenceLabel})
                        </Text>
                        <Text style={styles.suggestionReason}>
                          {topSuggestion.reason}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.mutedText}>
                        Geen betrouwbare suggestie gevonden.
                      </Text>
                    )}

                    <View style={styles.queueActionsWrap}>
                      {topSuggestion ? (
                        <TouchableOpacity
                          style={styles.primaryBtn}
                          onPress={() =>
                            void handleLinkTransaction(
                              item,
                              topSuggestion.subscriptionProfileId,
                              topSuggestion.confidence,
                            )
                          }
                          disabled={isBusy}
                        >
                          <Text style={styles.primaryBtnText}>Koppel</Text>
                        </TouchableOpacity>
                      ) : null}

                      <View style={styles.queueSecondaryActions}>
                        <TouchableOpacity
                          style={styles.ghostBtn}
                          onPress={() => setChooseProfileTx(item)}
                          disabled={isBusy}
                        >
                          <Text style={styles.ghostBtnText}>
                            Kies abonnement
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ghostBtn}
                          onPress={() => openCreateProfileModal(item)}
                          disabled={isBusy}
                        >
                          <Text style={styles.ghostBtnText}>
                            Nieuw abonnement
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ghostBtn}
                          onPress={() => void handleMarkNotSubscription(item)}
                          disabled={isBusy}
                        >
                          <Text
                            style={[
                              styles.ghostBtnText,
                              { color: FinColors.red },
                            ]}
                          >
                            Geen abonnement
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.detailLinkBtn}
                      onPress={() =>
                        router.push(
                          `/transaction-detail?id=${item.transactionId}`,
                        )
                      }
                    >
                      <Text style={styles.detailLinkText}>
                        Open transactie →
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={profileModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setProfileModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollContent}
            >
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>
                  {editingProfile ? "Abonnement bewerken" : "Nieuw abonnement"}
                </Text>
                <TouchableOpacity onPress={() => setProfileModalOpen(false)}>
                  <AppIcon
                    name="close"
                    size={18}
                    color={FinColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalInput}
                value={profileName}
                onChangeText={(value) => {
                  setProfileName(value);
                  if (profileFormError) setProfileFormError(null);
                }}
                placeholder="Naam (bijv. Netflix)"
                placeholderTextColor={FinColors.textMuted}
              />

              <Text style={styles.modalFieldHint}>
                Gebruik hier de dienstnaam, niet de ruwe transactietekst.
              </Text>

              <Text style={styles.modalSectionLabel}>Factuurcyclus</Text>
              <View style={styles.modalChipRow}>
                {BILLING_CYCLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.modalChip,
                      billingCycle === option.value && styles.modalChipActive,
                    ]}
                    onPress={() => setBillingCycle(option.value)}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        billingCycle === option.value &&
                          styles.modalChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalSectionLabel}>Verwacht bedrag</Text>
              <View style={styles.inlineInputRow}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  value={expectedAmountInput}
                  onChangeText={(value) => {
                    setExpectedAmountInput(value);
                    if (profileFormError) setProfileFormError(null);
                  }}
                  placeholder="Verwacht bedrag"
                  placeholderTextColor={FinColors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.amountMatchWrap}>
                <Text style={styles.modalSectionLabel}>Bedrag matcht op</Text>
                <View style={styles.modalChipRow}>
                  <TouchableOpacity
                    style={[
                      styles.modalChip,
                      amountMatchMode === "fixed" && styles.modalChipActive,
                    ]}
                    onPress={() => setAmountMatchMode("fixed")}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        amountMatchMode === "fixed" &&
                          styles.modalChipTextActive,
                      ]}
                    >
                      Vast bedrag
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalChip,
                      amountMatchMode === "flexible" && styles.modalChipActive,
                    ]}
                    onPress={() => setAmountMatchMode("flexible")}
                  >
                    <Text
                      style={[
                        styles.modalChipText,
                        amountMatchMode === "flexible" &&
                          styles.modalChipTextActive,
                      ]}
                    >
                      Mag afwijken
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.modalFieldHint}>
                {amountMatchMode === "fixed"
                  ? "We matchen alleen op precies dit bedrag."
                  : "We laten een kleine afwijking rond dit bedrag toe."}
              </Text>

              <View style={styles.inlineInputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalSectionLabel}>
                    Verwachte dag van afschrijving
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    value={expectedDayInput}
                    onChangeText={(value) => {
                      setExpectedDayInput(value);
                      if (profileFormError) setProfileFormError(null);
                    }}
                    placeholder="Bijv. 12"
                    placeholderTextColor={FinColors.textMuted}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              {createForTransaction?.providerDetected ? (
                <Text style={styles.modalFieldHint}>
                  Betaaldienst automatisch herkend als{" "}
                  {getProviderHintLabel(createForTransaction.providerDetected)}.
                  Die herkenning gebruiken we op de achtergrond voor historische
                  controle en matching.
                </Text>
              ) : null}

              <View style={styles.rulesWrap}>
                <Text style={styles.rulesTitle}>Herkenningsregels</Text>
                <Text style={styles.mutedText}>
                  Zo herkennen we toekomstige betalingen voor dit abonnement.
                </Text>

                <View style={styles.ruleSectionCard}>
                  <Text style={styles.ruleSectionTitle}>Ingestelde regels</Text>
                  {modalRules.length === 0 ? (
                    <Text style={styles.mutedText}>
                      Nog geen herkenningsregels ingesteld.
                    </Text>
                  ) : (
                    modalRules.map((rule) => (
                      <View key={rule.key} style={styles.ruleRow}>
                        <Text style={styles.ruleText} numberOfLines={1}>
                          {rule.pattern}
                        </Text>
                        <Text style={styles.ruleTypePill}>
                          {rule.patternType === "details_contains"
                            ? "details"
                            : "tegenpartij"}
                        </Text>
                        <TouchableOpacity
                          style={styles.ruleDeleteBtn}
                          onPress={() => handleRemoveModalRule(rule.key)}
                        >
                          <AppIcon
                            name="close"
                            size={18}
                            color={FinColors.red}
                            variant="outlined"
                          />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.ruleComposerCard}>
                  <Text style={styles.ruleSectionTitle}>Nieuwe regel toevoegen</Text>
                  <Text style={styles.ruleComposerHint}>
                    Kies of we zoeken in de tegenpartij of in de omschrijving.
                  </Text>

                  <View style={styles.ruleDraftTypeRow}>
                    <TouchableOpacity
                      style={[
                        styles.ruleTypeBtn,
                        modalRuleDraft.patternType === "details_contains" &&
                          styles.ruleTypeBtnActive,
                      ]}
                      onPress={() =>
                        setModalRuleDraft((current) => ({
                          ...current,
                          patternType: "details_contains",
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.ruleTypeBtnText,
                          modalRuleDraft.patternType === "details_contains" &&
                            styles.ruleTypeBtnTextActive,
                        ]}
                      >
                        details
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.ruleTypeBtn,
                        modalRuleDraft.patternType === "counterparty_contains" &&
                          styles.ruleTypeBtnActive,
                      ]}
                      onPress={() =>
                        setModalRuleDraft((current) => ({
                          ...current,
                          patternType: "counterparty_contains",
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.ruleTypeBtnText,
                          modalRuleDraft.patternType === "counterparty_contains" &&
                            styles.ruleTypeBtnTextActive,
                        ]}
                      >
                        tegenpartij
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.ruleDraftRow}>
                    <TextInput
                      style={styles.ruleInput}
                      value={modalRuleDraft.pattern}
                      onChangeText={(value) =>
                        setModalRuleDraft((current) => ({
                          ...current,
                          pattern: value,
                        }))
                      }
                      placeholder="Bijv. netflix of spotify premium"
                      placeholderTextColor={FinColors.textMuted}
                    />
                    <TouchableOpacity
                      style={styles.primaryBtnSmall}
                      onPress={handleAddModalRule}
                    >
                      <Text style={styles.primaryBtnSmallText}>Toevoegen</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Profiel actief</Text>
                <Switch
                  value={profileIsActive}
                  onValueChange={setProfileIsActive}
                  trackColor={{
                    false: FinColors.bgElevated,
                    true: FinColors.greenBorder,
                  }}
                  thumbColor={
                    profileIsActive ? FinColors.green : FinColors.textMuted
                  }
                />
              </View>

              {billingCycle === "monthly" ? (
                <View style={styles.validationInfoWrap}>
                  {createForTransaction ? (
                    <Text style={styles.mutedText}>
                      Dit profiel wordt direct gekoppeld aan de geselecteerde
                      betaling.
                    </Text>
                  ) : (
                    <Text style={styles.mutedText}>
                      Kandidaten worden live ververst op basis van naam,
                      herkenningsregels, bedrag en afschrijvingsdag.
                    </Text>
                  )}

                  <Text style={styles.modalSectionLabel}>
                    Mogelijke vorige betalingen
                  </Text>
                  <Text style={styles.modalFieldHint}>
                    Deze betalingen lijken al bij dit abonnement te horen.
                    Aangevinkte betalingen worden gekoppeld bij opslaan.
                  </Text>

                  {validationLoading ? (
                    <View style={styles.validationLoadingRow}>
                      <ActivityIndicator size="small" color={FinColors.green} />
                      <Text style={styles.mutedText}>
                        Vorige transacties laden…
                      </Text>
                    </View>
                  ) : validationError ? (
                    <Text style={styles.errorText}>{validationError}</Text>
                  ) : validationCandidates.length === 0 ? (
                    <Text style={styles.mutedText}>
                      Nog geen passende eerdere betalingen gevonden.
                    </Text>
                  ) : (
                    <View style={styles.validationListWrap}>
                      {validationCandidates.map((candidate) => {
                        const selected =
                          selectedValidationCandidateIds.includes(
                            candidate.transactionId,
                          );
                        return (
                          <TouchableOpacity
                            key={candidate.transactionId}
                            style={[
                              styles.validationItem,
                              selected && styles.validationItemSelected,
                            ]}
                            onPress={() =>
                              toggleValidationCandidate(candidate.transactionId)
                            }
                          >
                            <View style={styles.validationItemHeaderRow}>
                              <AppIcon
                                name={
                                  selected
                                    ? "check-box"
                                    : "check-box-outline-blank"
                                }
                                size={18}
                                color={
                                  selected
                                    ? FinColors.green
                                    : FinColors.textMuted
                                }
                              />
                              <Text style={styles.validationItemDate}>
                                {formatDateLabel(candidate.date)}
                              </Text>
                              <Text style={styles.validationItemAmount}>
                                -
                                {euroFormatter.format(
                                  Math.abs(candidate.amount),
                                )}
                              </Text>
                            </View>
                            <Text
                              style={styles.validationItemSubject}
                              numberOfLines={2}
                            >
                              {extractSubject(candidate.details)}
                            </Text>
                            <Text style={styles.validationItemMeta}>
                              {candidate.counterparty ||
                                "Onbekende tegenpartij"}{" "}
                              · {getProviderHintLabel(candidate.providerDetected)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      <Text style={styles.modalFieldHint}>
                        Geselecteerd: {selectedValidationCandidateIds.length}
                      </Text>
                    </View>
                  )}
                </View>
              ) : null}

              {profileFormError ? (
                <View style={styles.modalErrorCard}>
                  <Text style={styles.errorText}>{profileFormError}</Text>
                </View>
              ) : null}

              <View style={styles.modalActionsRow}>
                {editingProfile ? (
                  <TouchableOpacity
                    style={[styles.ghostBtn, styles.modalDangerBtn]}
                    onPress={() => setProfilePendingDelete(editingProfile)}
                    disabled={savingProfile || deletingProfileId === editingProfile.id}
                  >
                    {deletingProfileId === editingProfile.id ? (
                      <ActivityIndicator size="small" color={FinColors.red} />
                    ) : (
                      <>
                        <AppIcon
                          name="delete-outline"
                          size={15}
                          color={FinColors.red}
                          variant="outlined"
                        />
                        <Text
                          style={[
                            styles.ghostBtnText,
                            styles.ghostDangerBtnText,
                          ]}
                        >
                          Verwijder profiel
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => setProfileModalOpen(false)}
                  disabled={savingProfile}
                >
                  <Text style={styles.ghostBtnText}>Annuleren</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => void handleSaveProfile()}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color={FinColors.bgBase} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Opslaan</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={chooseProfileTx != null}
        transparent
        animationType="fade"
        onRequestClose={() => setChooseProfileTx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Kies abonnement</Text>
              <TouchableOpacity onPress={() => setChooseProfileTx(null)}>
                <AppIcon
                  name="close"
                  size={18}
                  color={FinColors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {chooseProfileTx ? (
              <Text style={styles.mutedText}>
                {extractSubject(chooseProfileTx.details)} · -
                {euroFormatter.format(Math.abs(chooseProfileTx.amount))}
              </Text>
            ) : null}

            <View style={styles.modalListWrap}>
              {profiles.filter((profile) => profile.isActive).length === 0 ? (
                <Text style={styles.mutedText}>
                  Geen actieve profielen beschikbaar. Maak eerst een nieuw
                  profiel aan.
                </Text>
              ) : (
                profiles
                  .filter((profile) => profile.isActive)
                  .map((profile) => (
                    <TouchableOpacity
                      key={profile.id}
                      style={styles.modalListItem}
                      onPress={() => {
                        if (!chooseProfileTx) return;
                        void handleLinkTransaction(
                          chooseProfileTx,
                          profile.id,
                          1,
                        );
                      }}
                    >
                      <Text style={styles.modalListItemTitle}>
                        {profile.name}
                      </Text>
                      <Text style={styles.modalListItemMeta}>
                        {BILLING_CYCLE_OPTIONS.find(
                          (option) => option.value === profile.billingCycle,
                        )?.label || "Maandelijks"}
                      </Text>
                    </TouchableOpacity>
                  ))
              )}
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => setChooseProfileTx(null)}
              >
                <Text style={styles.ghostBtnText}>Sluiten</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  const target = chooseProfileTx;
                  setChooseProfileTx(null);
                  if (target) {
                    openCreateProfileModal(target);
                  }
                }}
              >
                <Text style={styles.primaryBtnText}>Nieuw abonnement</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={profilePendingDelete != null}
        transparent
        animationType="fade"
        onRequestClose={() => setProfilePendingDelete(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalIconWrap}>
              <AppIcon
                name="delete-outline"
                size={20}
                color={FinColors.red}
                variant="outlined"
              />
            </View>
            <Text style={styles.confirmModalTitle}>Profiel verwijderen?</Text>
            <Text style={styles.confirmModalText}>
              {profilePendingDelete
                ? `Je verwijdert ${profilePendingDelete.name}. De bijbehorende rules worden ook verwijderd. Gekoppelde transacties blijven bestaan.`
                : "Dit profiel wordt verwijderd."}
            </Text>
            <View style={styles.confirmModalActionsRow}>
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() => setProfilePendingDelete(null)}
                disabled={Boolean(deletingProfileId)}
              >
                <Text style={styles.ghostBtnText}>Annuleren</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={() =>
                  profilePendingDelete
                    ? void handleDeleteProfile(profilePendingDelete)
                    : undefined
                }
                disabled={Boolean(deletingProfileId)}
              >
                {deletingProfileId ? (
                  <ActivityIndicator size="small" color={FinColors.bgCard} />
                ) : (
                  <Text style={styles.confirmDeleteBtnText}>Verwijderen</Text>
                )}
              </TouchableOpacity>
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
  },
  topBar: {
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  pageTitle: {
    color: FinColors.textPrimary,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  heroCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: 18,
    gap: 12,
  },
  heroEyebrow: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroTitle: {
    color: FinColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  heroCopy: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  heroMetricsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroMetricCard: {
    minWidth: 112,
    flexGrow: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 4,
  },
  heroMetricLabel: {
    color: FinColors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  heroMetricValue: {
    color: FinColors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
  },
  heroHint: {
    color: FinColors.green,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  sectionCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.border,
    padding: 14,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    opacity: 0.75,
  },
  smallActionBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallActionBtnText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  mutedText: {
    color: FinColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  profileCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 10,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  profileName: {
    color: FinColors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  profileMeta: {
    color: FinColors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  profileActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  ghostDangerBtn: {
    borderColor: FinColors.redBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ghostDangerBtnText: {
    color: FinColors.red,
  },
  rulesWrap: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 10,
  },
  rulesTitle: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "700",
  },
  ruleSectionCard: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ruleComposerCard: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  ruleSectionTitle: {
    color: FinColors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  ruleComposerHint: {
    color: FinColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  ruleText: {
    flex: 1,
    color: FinColors.textPrimary,
    fontSize: 13,
  },
  ruleTypePill: {
    color: FinColors.green,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  ruleDeleteBtn: {
    padding: 2,
  },
  ruleDraftTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  ruleTypeBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  ruleTypeBtnActive: {
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  ruleTypeBtnText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  ruleTypeBtnTextActive: {
    color: FinColors.green,
  },
  ruleDraftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    color: FinColors.textPrimary,
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  primaryBtnSmall: {
    borderRadius: 8,
    backgroundColor: FinColors.green,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  primaryBtnSmallText: {
    color: FinColors.bgBase,
    fontSize: 12,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  toggleLabel: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  queueCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    padding: 12,
    gap: 8,
  },
  queueHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  queueDate: {
    color: FinColors.textMuted,
    fontSize: 12,
  },
  queueAmount: {
    color: FinColors.red,
    fontSize: 14,
    fontWeight: "700",
  },
  queueCounterparty: {
    color: FinColors.textPrimary,
    fontSize: 14,
    fontWeight: "700",
  },
  queueSubject: {
    color: FinColors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  suggestionBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
    padding: 8,
    gap: 4,
  },
  suggestionTitle: {
    color: FinColors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  suggestionValue: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  suggestionReason: {
    color: FinColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  queueActionsWrap: {
    marginTop: 2,
    gap: 8,
  },
  queueSecondaryActions: {
    gap: 8,
  },
  primaryBtn: {
    borderRadius: 10,
    backgroundColor: FinColors.green,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: FinColors.bgBase,
    fontSize: 14,
    fontWeight: "700",
  },
  ghostBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostBtnText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  detailLinkBtn: {
    marginTop: 2,
    alignSelf: "flex-start",
  },
  detailLinkText: {
    color: FinColors.green,
    fontSize: 12,
    fontWeight: "600",
  },
  errorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.red,
    backgroundColor: FinColors.redBg,
    padding: 10,
  },
  errorText: {
    color: FinColors.red,
    fontSize: 12,
    lineHeight: 17,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgCard,
    padding: 14,
    gap: 10,
    maxHeight: "85%",
  },
  modalScrollContent: {
    paddingBottom: 4,
    gap: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalTitle: {
    color: FinColors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  modalInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    color: FinColors.textPrimary,
    fontSize: 13,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  modalSectionLabel: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  modalFieldHint: {
    color: FinColors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: -2,
  },
  amountMatchWrap: {
    gap: 6,
  },
  modalChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalChip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  modalChipActive: {
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  modalChipText: {
    color: FinColors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  modalChipTextActive: {
    color: FinColors.green,
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  validationInfoWrap: {
    gap: 8,
  },
  validationLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  validationListWrap: {
    gap: 8,
  },
  modalErrorCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: FinColors.red,
    backgroundColor: FinColors.redBg,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  validationItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 4,
  },
  validationItemSelected: {
    borderColor: FinColors.greenBorder,
    backgroundColor: FinColors.greenBg,
  },
  validationItemHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  validationItemDate: {
    color: FinColors.textPrimary,
    fontSize: 12,
    fontWeight: "600",
  },
  validationItemAmount: {
    marginLeft: "auto",
    color: FinColors.red,
    fontSize: 12,
    fontWeight: "700",
  },
  validationItemSubject: {
    color: FinColors.textPrimary,
    fontSize: 12,
    lineHeight: 17,
  },
  validationItemMeta: {
    color: FinColors.textMuted,
    fontSize: 11,
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  modalDangerBtn: {
    marginRight: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  confirmModalCard: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgCard,
    padding: 18,
    gap: 14,
  },
  confirmModalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.redBg,
    borderWidth: 1,
    borderColor: FinColors.redBorder,
  },
  confirmModalTitle: {
    color: FinColors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  confirmModalText: {
    color: FinColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  confirmModalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  confirmDeleteBtn: {
    minWidth: 120,
    borderRadius: 10,
    backgroundColor: FinColors.red,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  confirmDeleteBtnText: {
    color: FinColors.bgCard,
    fontSize: 13,
    fontWeight: "700",
  },
  modalListWrap: {
    gap: 8,
    maxHeight: 260,
  },
  modalListItem: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 3,
  },
  modalListItemTitle: {
    color: FinColors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  modalListItemMeta: {
    color: FinColors.textSecondary,
    fontSize: 12,
  },
});
