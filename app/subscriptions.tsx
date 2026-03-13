import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import {
  createSubscriptionProfile,
  deleteSubscriptionProfile,
  deleteSubscriptionProfileRule,
  getSubscriptionDashboardData,
  linkTransactionToSubscription,
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
} from "@/types/categorization";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
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

function deriveProfileNameFromQueueItem(item: SubscriptionQueueItem): string {
  const subject = extractSubject(item.details);
  const compact = subject.replace(/\s+/g, " ").trim();
  if (!compact) return "Nieuw abonnement";
  if (compact.length <= 40) return compact;
  return compact.slice(0, 40).trim();
}

function normalizeRouteParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0];
  return value;
}

type RuleDraft = {
  pattern: string;
  patternType: SubscriptionProfileRuleType;
};

function getDefaultRuleDraft(): RuleDraft {
  return {
    pattern: "",
    patternType: "details_contains",
  };
}

export default function SubscriptionsScreen() {
  const params = useLocalSearchParams<{ profileId?: string | string[] }>();
  const focusProfileId = React.useMemo(
    () => normalizeRouteParam(params.profileId),
    [params.profileId],
  );
  const router = useRouter();
  const handledFocusProfileIdRef = React.useRef<string | null>(null);

  const [loading, setLoading] = React.useState(true);
  const [savingProfile, setSavingProfile] = React.useState(false);
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
  const [ruleDraftByProfileId, setRuleDraftByProfileId] = React.useState<
    Record<string, RuleDraft>
  >({});

  const [setCategoryOnLink, setSetCategoryOnLink] = React.useState(true);
  const [chooseProfileTx, setChooseProfileTx] = React.useState<
    SubscriptionQueueItem | null
  >(null);

  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<SubscriptionProfile | null>(
    null,
  );
  const [createForTransaction, setCreateForTransaction] = React.useState<
    SubscriptionQueueItem | null
  >(null);

  const [profileName, setProfileName] = React.useState("");
  const [billingCycle, setBillingCycle] = React.useState<SubscriptionBillingCycle>(
    "monthly",
  );
  const [expectedAmountInput, setExpectedAmountInput] = React.useState("");
  const [toleranceInput, setToleranceInput] = React.useState("2");
  const [expectedDayInput, setExpectedDayInput] = React.useState("");
  const [providerHint, setProviderHint] = React.useState<
    SubscriptionProviderHint | null
  >(null);
  const [profileIsActive, setProfileIsActive] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { monthStartIso, monthEndIso } = getCurrentMonthBounds();
      const { profiles: loadedProfiles, queueItems, rulesByProfileId } =
        await getSubscriptionDashboardData(monthStartIso, monthEndIso);

      const nextRuleDraftByProfileId: Record<string, RuleDraft> = {};

      for (const profileId of Object.keys(rulesByProfileId)) {
        nextRuleDraftByProfileId[profileId] = getDefaultRuleDraft();
      }

      setProfiles(loadedProfiles);
      setQueueItems(queueItems);
      setRulesByProfileId(rulesByProfileId);
      setRuleDraftByProfileId(nextRuleDraftByProfileId);
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
    setToleranceInput("2");
    setExpectedDayInput("");
    setProviderHint(null);
    setProfileIsActive(true);
  }, []);

  const openCreateProfileModal = React.useCallback(
    (queueItem?: SubscriptionQueueItem) => {
      resetProfileForm();
      setEditingProfile(null);
      setCreateForTransaction(queueItem || null);
      if (queueItem) {
        setProfileName(deriveProfileNameFromQueueItem(queueItem));
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
      setToleranceInput(String(profile.amountTolerance));
      setExpectedDayInput(
        profile.expectedDayOfMonth == null ? "" : String(profile.expectedDayOfMonth),
      );
      setProviderHint(profile.providerHint);
      setProfileIsActive(profile.isActive);
      setProfileModalOpen(true);
    },
    [],
  );

  React.useEffect(() => {
    if (!focusProfileId || loading) return;
    if (handledFocusProfileIdRef.current === focusProfileId) return;

    const targetProfile = profiles.find((profile) => profile.id === focusProfileId);
    if (!targetProfile) return;

    handledFocusProfileIdRef.current = focusProfileId;
    openEditProfileModal(targetProfile);
  }, [focusProfileId, loading, openEditProfileModal, profiles]);

  const handleSaveProfile = React.useCallback(async () => {
    const trimmedName = String(profileName || "").trim();
    if (!trimmedName) {
      setErrorMessage("Voer een naam voor het abonnement in.");
      return;
    }

    setSavingProfile(true);
    setErrorMessage(null);

    try {
      const expectedAmount = parseNumberOrNull(expectedAmountInput);
      const tolerance = parseNumberOrNull(toleranceInput);
      const expectedDay = parseIntegerOrNull(expectedDayInput);

      let savedProfile: SubscriptionProfile;
      if (editingProfile) {
        savedProfile = await updateSubscriptionProfile(editingProfile.id, {
          name: trimmedName,
          billingCycle,
          expectedAmount,
          amountTolerance: tolerance == null ? undefined : Math.max(tolerance, 0),
          expectedDayOfMonth: expectedDay,
          providerHint,
          isActive: profileIsActive,
        });
      } else {
        savedProfile = await createSubscriptionProfile({
          name: trimmedName,
          billingCycle,
          expectedAmount,
          amountTolerance: tolerance == null ? undefined : Math.max(tolerance, 0),
          expectedDayOfMonth: expectedDay,
          providerHint,
          isActive: profileIsActive,
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

      setProfileModalOpen(false);
      setEditingProfile(null);
      setCreateForTransaction(null);
      await loadData();
    } catch (error) {
      console.warn("[subscriptions] save profile error", error);
      const message =
        error instanceof Error ? error.message : "Kon profiel niet opslaan.";
      setErrorMessage(message);
    } finally {
      setSavingProfile(false);
    }
  }, [
    billingCycle,
    createForTransaction,
    editingProfile,
    expectedAmountInput,
    expectedDayInput,
    loadData,
    profileIsActive,
    profileName,
    providerHint,
    setCategoryOnLink,
    toleranceInput,
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
    async (profileId: string) => {
      try {
        await deleteSubscriptionProfile(profileId);
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] delete profile error", error);
        const message =
          error instanceof Error
            ? error.message
            : "Kon abonnement niet verwijderen.";
        setErrorMessage(message);
      }
    },
    [loadData],
  );

  const handleRuleDraftChange = React.useCallback(
    (profileId: string, patch: Partial<RuleDraft>) => {
      setRuleDraftByProfileId((current) => ({
        ...current,
        [profileId]: {
          ...(current[profileId] || getDefaultRuleDraft()),
          ...patch,
        },
      }));
    },
    [],
  );

  const handleAddRule = React.useCallback(
    async (profileId: string) => {
      const draft = ruleDraftByProfileId[profileId] || getDefaultRuleDraft();
      const pattern = String(draft.pattern || "").trim();
      if (!pattern) {
        setErrorMessage("Voer eerst een alias of patroon in.");
        return;
      }

      try {
        await upsertSubscriptionProfileRule({
          subscriptionProfileId: profileId,
          pattern,
          patternType: draft.patternType,
        });
        setRuleDraftByProfileId((current) => ({
          ...current,
          [profileId]: getDefaultRuleDraft(),
        }));
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] add rule error", error);
        const message =
          error instanceof Error ? error.message : "Kon rule niet opslaan.";
        setErrorMessage(message);
      }
    },
    [loadData, ruleDraftByProfileId],
  );

  const handleDeleteRule = React.useCallback(
    async (ruleId: string) => {
      try {
        await deleteSubscriptionProfileRule(ruleId);
        await loadData();
      } catch (error) {
        console.warn("[subscriptions] delete rule error", error);
        const message =
          error instanceof Error ? error.message : "Kon rule niet verwijderen.";
        setErrorMessage(message);
      }
    },
    [loadData],
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
        <Text style={styles.pageTitle}>Abonnementenbeheer</Text>
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

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Abonnementen</Text>
              <TouchableOpacity
                style={styles.smallActionBtn}
                onPress={() => openCreateProfileModal()}
              >
                <Text style={styles.smallActionBtnText}>Nieuw profiel</Text>
              </TouchableOpacity>
            </View>

            {profiles.length === 0 ? (
              <Text style={styles.mutedText}>
                Nog geen abonnementen ingesteld. Voeg een profiel toe om PSP-betalingen te koppelen.
              </Text>
            ) : (
              profiles.map((profile) => {
                const rules = rulesByProfileId[profile.id] || [];
                const draft = ruleDraftByProfileId[profile.id] ||
                  getDefaultRuleDraft();

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
                          {profile.providerHint
                            ? ` · ${PROVIDER_HINT_OPTIONS.find((option) => option.value === profile.providerHint)?.label || profile.providerHint}`
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
                          profile.isActive ? FinColors.green : FinColors.textMuted
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
                        style={styles.ghostBtn}
                        onPress={() => void handleDeleteProfile(profile.id)}
                      >
                        <Text style={[styles.ghostBtnText, { color: FinColors.red }]}>Verwijder</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.rulesWrap}>
                      <Text style={styles.rulesTitle}>Rules / aliases</Text>
                      {rules.length === 0 ? (
                        <Text style={styles.mutedText}>Nog geen regels ingesteld.</Text>
                      ) : (
                        rules.map((rule) => (
                          <View key={rule.id} style={styles.ruleRow}>
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
                              onPress={() => void handleDeleteRule(rule.id)}
                            >
                              <MaterialIcons
                                name="delete-outline"
                                size={18}
                                color={FinColors.red}
                              />
                            </TouchableOpacity>
                          </View>
                        ))
                      )}

                      <View style={styles.ruleDraftTypeRow}>
                        <TouchableOpacity
                          style={[
                            styles.ruleTypeBtn,
                            draft.patternType === "details_contains" &&
                              styles.ruleTypeBtnActive,
                          ]}
                          onPress={() =>
                            handleRuleDraftChange(profile.id, {
                              patternType: "details_contains",
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.ruleTypeBtnText,
                              draft.patternType === "details_contains" &&
                                styles.ruleTypeBtnTextActive,
                            ]}
                          >
                            details
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.ruleTypeBtn,
                            draft.patternType === "counterparty_contains" &&
                              styles.ruleTypeBtnActive,
                          ]}
                          onPress={() =>
                            handleRuleDraftChange(profile.id, {
                              patternType: "counterparty_contains",
                            })
                          }
                        >
                          <Text
                            style={[
                              styles.ruleTypeBtnText,
                              draft.patternType === "counterparty_contains" &&
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
                          value={draft.pattern}
                          onChangeText={(value) =>
                            handleRuleDraftChange(profile.id, { pattern: value })
                          }
                          placeholder="Bijv. netflix of spotify premium"
                          placeholderTextColor={FinColors.textMuted}
                        />
                        <TouchableOpacity
                          style={styles.primaryBtnSmall}
                          onPress={() => void handleAddRule(profile.id)}
                        >
                          <Text style={styles.primaryBtnSmallText}>Toevoegen</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Onbekende PSP-betalingen</Text>
              <TouchableOpacity style={styles.smallActionBtn} onPress={() => void loadData()}>
                <Text style={styles.smallActionBtnText}>Vernieuwen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Zet categorie op abonnementen</Text>
              <Switch
                value={setCategoryOnLink}
                onValueChange={setSetCategoryOnLink}
                trackColor={{ false: FinColors.bgElevated, true: FinColors.greenBorder }}
                thumbColor={setCategoryOnLink ? FinColors.green : FinColors.textMuted}
              />
            </View>

            {queueItems.length === 0 ? (
              <Text style={styles.mutedText}>
                Geen openstaande PSP-transacties zonder abonnementskoppeling in deze maand.
              </Text>
            ) : (
              queueItems.map((item) => {
                const topSuggestion = item.suggestions[0] || null;
                const isBusy = busyTransactionIds.includes(item.transactionId);
                return (
                  <View key={item.transactionId} style={styles.queueCard}>
                    <View style={styles.queueHeaderRow}>
                      <Text style={styles.queueDate}>{formatDateLabel(item.date)}</Text>
                      <Text style={styles.queueAmount}>-{euroFormatter.format(Math.abs(item.amount))}</Text>
                    </View>
                    <Text style={styles.queueCounterparty} numberOfLines={1}>
                      {item.counterparty || "Onbekende tegenpartij"}
                    </Text>
                    <Text style={styles.queueSubject} numberOfLines={2}>
                      {extractSubject(item.details)}
                    </Text>

                    {topSuggestion ? (
                      <View style={styles.suggestionBox}>
                        <Text style={styles.suggestionTitle}>Top suggestie</Text>
                        <Text style={styles.suggestionValue}>
                          {topSuggestion.subscriptionName} · {Math.round(topSuggestion.confidence * 100)}% ({topSuggestion.confidenceLabel})
                        </Text>
                        <Text style={styles.suggestionReason}>{topSuggestion.reason}</Text>
                      </View>
                    ) : (
                      <Text style={styles.mutedText}>Geen betrouwbare suggestie gevonden.</Text>
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
                          <Text style={styles.ghostBtnText}>Kies abonnement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ghostBtn}
                          onPress={() => openCreateProfileModal(item)}
                          disabled={isBusy}
                        >
                          <Text style={styles.ghostBtnText}>Nieuw abonnement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.ghostBtn}
                          onPress={() => void handleMarkNotSubscription(item)}
                          disabled={isBusy}
                        >
                          <Text style={[styles.ghostBtnText, { color: FinColors.red }]}>Geen abonnement</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.detailLinkBtn}
                      onPress={() =>
                        router.push(`/transaction-detail?id=${item.transactionId}`)
                      }
                    >
                      <Text style={styles.detailLinkText}>Open transactie →</Text>
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
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>
                {editingProfile ? "Abonnement bewerken" : "Nieuw abonnement"}
              </Text>
              <TouchableOpacity onPress={() => setProfileModalOpen(false)}>
                <MaterialIcons name="close" size={18} color={FinColors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={profileName}
              onChangeText={setProfileName}
              placeholder="Naam (bijv. Netflix)"
              placeholderTextColor={FinColors.textMuted}
            />

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
                      billingCycle === option.value && styles.modalChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.inlineInputRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={expectedAmountInput}
                onChangeText={setExpectedAmountInput}
                placeholder="Verwacht bedrag (optioneel)"
                placeholderTextColor={FinColors.textMuted}
                keyboardType="decimal-pad"
              />
              <TextInput
                style={[styles.modalInput, { width: 110 }]}
                value={toleranceInput}
                onChangeText={setToleranceInput}
                placeholder="Marge"
                placeholderTextColor={FinColors.textMuted}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.inlineInputRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={expectedDayInput}
                onChangeText={setExpectedDayInput}
                placeholder="Dag van maand (1-31)"
                placeholderTextColor={FinColors.textMuted}
                keyboardType="number-pad"
              />
              <View style={[styles.providerSelectWrap, { flex: 1.2 }]}> 
                <Text style={styles.modalSectionLabel}>Provider hint</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.modalChipRow}>
                    <TouchableOpacity
                      style={[styles.modalChip, providerHint == null && styles.modalChipActive]}
                      onPress={() => setProviderHint(null)}
                    >
                      <Text
                        style={[styles.modalChipText, providerHint == null && styles.modalChipTextActive]}
                      >
                        Geen
                      </Text>
                    </TouchableOpacity>
                    {PROVIDER_HINT_OPTIONS.map((option) => (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.modalChip,
                          providerHint === option.value && styles.modalChipActive,
                        ]}
                        onPress={() => setProviderHint(option.value)}
                      >
                        <Text
                          style={[
                            styles.modalChipText,
                            providerHint === option.value && styles.modalChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Profiel actief</Text>
              <Switch
                value={profileIsActive}
                onValueChange={setProfileIsActive}
                trackColor={{ false: FinColors.bgElevated, true: FinColors.greenBorder }}
                thumbColor={profileIsActive ? FinColors.green : FinColors.textMuted}
              />
            </View>

            {createForTransaction ? (
              <Text style={styles.mutedText}>
                Dit profiel wordt direct gekoppeld aan de geselecteerde PSP-transactie.
              </Text>
            ) : null}

            <View style={styles.modalActionsRow}>
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
                <MaterialIcons name="close" size={18} color={FinColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {chooseProfileTx ? (
              <Text style={styles.mutedText}>
                {extractSubject(chooseProfileTx.details)} · -{euroFormatter.format(Math.abs(chooseProfileTx.amount))}
              </Text>
            ) : null}

            <View style={styles.modalListWrap}>
              {profiles.filter((profile) => profile.isActive).length === 0 ? (
                <Text style={styles.mutedText}>
                  Geen actieve profielen beschikbaar. Maak eerst een nieuw profiel aan.
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
                        void handleLinkTransaction(chooseProfileTx, profile.id, 1);
                      }}
                    >
                      <Text style={styles.modalListItemTitle}>{profile.name}</Text>
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
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: FinColors.bgCard,
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
  providerSelectWrap: {
    gap: 6,
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 2,
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
