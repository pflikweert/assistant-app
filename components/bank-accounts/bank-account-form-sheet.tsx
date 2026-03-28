import { AppIcon } from "@/components/ui/app-icon";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinColors } from "@/constants/theme";
import {
  createBankAccount,
  updateBankAccount,
  type BankAccount,
  type BankAccountType,
} from "@/services/bank-accounts";
import {
  mapSimpleSettingsToLegacyMeaning,
  resolveDefaultExcludeFromNetWorthForKind,
  resolveDefaultSimpleUsageForKind,
  resolveSimpleAccountSettingsFromLegacy,
  type SimpleAccountKind,
  type SimpleAccountSettings,
  type SimpleAccountUsage,
} from "@/services/bank-account-simple-settings";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

type BankAccountFormMode = "create" | "edit";
type FormFieldKey = "name" | "provider" | "accountNumber";
type FormFieldErrors = Partial<Record<FormFieldKey, string>>;

type BankAccountFormSheetProps = {
  visible: boolean;
  mode: BankAccountFormMode;
  onClose: () => void;
  onSaved: (account: BankAccount) => void;
  title?: string;
  subtitle?: string;
  providerLabel?: string;
  sourceAccountNumber?: string | null;
  sourceAccountLabel?: string | null;
  account?: BankAccount | null;
  showSourceInfo?: boolean;
  showActiveToggle?: boolean;
  submitLabel?: string;
  onDelete?: (() => void) | null;
};

const ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  checking: "Betaalrekening",
  savings: "Spaarrekening",
  business: "Zakelijke rekening",
  investment: "Beleggingsrekening",
  credit: "Creditcard",
  loan: "Lening",
  cash: "Contant",
  other: "Overig",
};

const SIMPLE_ACCOUNT_KIND_OPTIONS: SimpleAccountKind[] = [
  "checking",
  "savings",
  "business",
  "investment",
];

const SIMPLE_USAGE_OPTIONS: { value: SimpleAccountUsage; label: string }[] = [
  { value: "personal", label: "Persoonlijk" },
  { value: "shared", label: "Samen" },
  { value: "exclude", label: "Niet meenemen" },
];

function getUsageLabel(usage: SimpleAccountUsage): string {
  switch (usage) {
    case "shared":
      return "samen";
    case "exclude":
      return "niet meenemen";
    case "personal":
    default:
      return "persoonlijk";
  }
}

export function buildLiveSummaryText(input: SimpleAccountSettings) {
  const usageLabel = getUsageLabel(input.usage);
  if (input.usage === "exclude") {
    if (input.excludeFromNetWorth) {
      return "Deze rekening blijft volledig buiten budget, voorspelling en totaal vermogen.";
    }
    return "Deze rekening telt niet mee in budget of voorspelling, maar wel in totaal vermogen.";
  }

  if (input.kind === "savings") {
    return `Deze ${usageLabel} rekening telt mee als reserve in je overzicht.`;
  }

  return `Deze ${usageLabel} rekening helpt mee in je dagelijkse sturing en vooruitblik.`;
}

export function resolveDefaultsForCreate(kind: SimpleAccountKind): SimpleAccountSettings {
  return {
    kind,
    usage: resolveDefaultSimpleUsageForKind(kind),
    excludeFromNetWorth: resolveDefaultExcludeFromNetWorthForKind(kind),
  };
}

export function buildBankAccountFormInitialMeaning(params: {
  mode: BankAccountFormMode;
  kind: SimpleAccountKind;
  account?: BankAccount | null;
}): SimpleAccountSettings {
  const { mode, kind, account } = params;
  if (mode === "edit" && account) {
    return resolveSimpleAccountSettingsFromLegacy(account);
  }
  return resolveDefaultsForCreate(kind);
}

function buildDefaultName(providerLabel?: string | null) {
  const trimmedProvider = String(providerLabel || "").trim();
  if (!trimmedProvider) return "Bankrekening";
  return `${trimmedProvider} rekening`;
}

export function BankAccountFormSheet({
  visible,
  mode,
  onClose,
  onSaved,
  title,
  subtitle,
  providerLabel,
  sourceAccountNumber,
  sourceAccountLabel,
  account,
  showSourceInfo = false,
  showActiveToggle = false,
  submitLabel,
  onDelete,
}: BankAccountFormSheetProps) {
  const isEdit = mode === "edit";
  const [name, setName] = React.useState("");
  const [provider, setProvider] = React.useState("");
  const [accountNumber, setAccountNumber] = React.useState("");
  const [kind, setKind] = React.useState<SimpleAccountKind>("checking");
  const [showAccountTypeDropdown, setShowAccountTypeDropdown] = React.useState(false);
  const [usage, setUsage] = React.useState<SimpleAccountUsage>("personal");
  const [excludeFromNetWorth, setExcludeFromNetWorth] = React.useState(false);
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [isActive, setIsActive] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<FormFieldErrors>({});
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!visible) return;

    setName(
      isEdit
        ? account?.name || buildDefaultName(account?.provider || providerLabel)
        : "",
    );
    setProvider(isEdit ? account?.provider || "" : providerLabel || "");
    setAccountNumber(isEdit ? "" : sourceAccountNumber || "");
    const nextKind =
      isEdit && (account?.account_type === "savings" ||
      account?.account_type === "business" ||
      account?.account_type === "investment")
        ? account.account_type
        : "checking";
    setKind(nextKind);
    const initialMeaning = buildBankAccountFormInitialMeaning({
      mode,
      kind: nextKind,
      account,
    });
    setUsage(initialMeaning.usage);
    setExcludeFromNetWorth(initialMeaning.excludeFromNetWorth);
    setIsActive(isEdit ? Boolean(account?.is_active) : true);
    setAdvancedOpen(false);
    setShowAccountTypeDropdown(false);
    setSaving(false);
    setFieldErrors({});
    setSubmitError(null);
  }, [account, isEdit, mode, providerLabel, sourceAccountNumber, visible]);

  React.useEffect(() => {
    if (!visible || isEdit) return;
    const defaults = resolveDefaultsForCreate(kind);
    setUsage(defaults.usage);
    setExcludeFromNetWorth(defaults.excludeFromNetWorth);
  }, [kind, isEdit, visible]);

  const resolvedTitle =
    title ||
    (isEdit ? "Rekening bewerken" : "Nieuwe rekening");
  const resolvedSubtitle =
    subtitle ||
    (isEdit
      ? "Werk naam, type en instellingen van deze rekening bij."
      : "Voeg een rekening toe en bepaal hoe die meetelt in je overzicht.");
  const resolvedSubmitLabel =
    submitLabel || (isEdit ? "Wijzigingen opslaan" : "Rekening aanmaken");
  const accountPlaceholder = isEdit
    ? account?.account_masked || "Laat leeg om ongewijzigd te laten"
    : sourceAccountNumber || "Rekeningnummer";
  const accountHelperText =
    isEdit && account?.account_masked
      ? `Laat leeg om ${account.account_masked} te behouden.`
      : null;
  const liveSummary = buildLiveSummaryText({
    usage,
    kind,
    excludeFromNetWorth,
  });
  const handleSave = React.useCallback(async () => {
    const trimmedName = name.trim();
    const trimmedProvider = provider.trim();
    const trimmedAccountNumber = accountNumber.trim();
    const nextFieldErrors: FormFieldErrors = {};

    if (!trimmedName) nextFieldErrors.name = "Geef je rekening een naam.";
    if (!trimmedProvider) nextFieldErrors.provider = "Vul bank of aanbieder in.";
    if (!isEdit && !trimmedAccountNumber) {
      nextFieldErrors.accountNumber = "Vul een rekeningnummer in.";
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSubmitError(null);
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setSubmitError(null);
    try {
      const meaning = mapSimpleSettingsToLegacyMeaning({
        settings: {
          usage,
          kind,
          excludeFromNetWorth,
        },
        currentOwnerScope: account?.owner_scope,
      });
      const savedAccount = isEdit
        ? await updateBankAccount({
            id: account?.id || "",
            name: trimmedName,
            provider: trimmedProvider || null,
            accountType: meaning.accountType,
            includeInBudget: meaning.includeInBudget,
            includeInNetWorth: meaning.includeInNetWorth,
            includeInCashflow: meaning.includeInCashflow,
            ownerScope: meaning.ownerScope,
            forecastRole: meaning.forecastRole,
            isActive,
            ...(trimmedAccountNumber ? { accountNumber: trimmedAccountNumber } : {}),
          })
        : await createBankAccount({
            name: trimmedName,
            accountType: meaning.accountType,
            provider: trimmedProvider || providerLabel || null,
            accountNumber: trimmedAccountNumber || null,
            includeInBudget: meaning.includeInBudget,
            includeInNetWorth: meaning.includeInNetWorth,
            includeInCashflow: meaning.includeInCashflow,
            ownerScope: meaning.ownerScope,
            forecastRole: meaning.forecastRole,
            isActive,
          });
      onSaved(savedAccount);
      onClose();
    } catch (nextError) {
      setSubmitError(
        nextError instanceof Error
          ? nextError.message
          : isEdit
            ? "We konden de rekening niet bijwerken."
            : "We konden de rekening niet aanmaken.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    account?.id,
    account?.owner_scope,
    accountNumber,
    excludeFromNetWorth,
    isActive,
    isEdit,
    kind,
    name,
    onClose,
    onSaved,
    provider,
    providerLabel,
    usage,
  ]);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      title={resolvedTitle}
      subtitle={resolvedSubtitle}
      onClose={onClose}
      bodyStyle={styles.body}
      footerStyle={styles.footer}
      footer={
        <View style={styles.footerActions}>
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              onPress={onDelete}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.deleteButtonPressed,
              ]}
            >
              <AppIcon name="delete-outline" size={18} color={FinColors.red} variant="outlined" />
              <Text style={styles.deleteButtonText}>Rekening verwijderen</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.saveButton,
              (saving || pressed) && styles.saveButtonPressed,
            ]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={FinColors.bgBase} />
            ) : (
              <>
                <Text style={styles.saveButtonText}>{resolvedSubmitLabel}</Text>
                <AppIcon
                  name="arrow-forward"
                  size={18}
                  color={FinColors.bgBase}
                  variant="outlined"
                />
              </>
            )}
          </Pressable>
        </View>
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {showSourceInfo && sourceAccountLabel ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Bronrekening</Text>
            <Text style={styles.infoValue}>{sourceAccountLabel}</Text>
            <Text style={styles.infoText}>
              We vullen de basis alvast in. Jij kiest alleen nog de budgetinstelling, naam en het type.
            </Text>
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={styles.sectionLabel}>Basisgegevens</Text>
        </View>

        <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Geef je rekening een naam</Text>
          <TextInput
            value={name}
            onChangeText={(value) => {
              setName(value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
            placeholder="Bijv. Gezamenlijke boodschappen"
            placeholderTextColor={FinColors.textMuted}
            style={styles.textInput}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {fieldErrors.name ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.name}</Text>
          ) : null}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Bank of aanbieder</Text>
          <TextInput
            value={provider}
            onChangeText={(value) => {
              setProvider(value);
              setFieldErrors((current) => ({ ...current, provider: undefined }));
            }}
            placeholder={providerLabel || "Bijv. ING"}
            placeholderTextColor={FinColors.textMuted}
            style={styles.textInput}
            autoCapitalize="words"
            autoCorrect={false}
          />
          {fieldErrors.provider ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.provider}</Text>
          ) : null}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Rekeningnummer</Text>
          <TextInput
            value={accountNumber}
            onChangeText={(value) => {
              setAccountNumber(value);
              setFieldErrors((current) => ({ ...current, accountNumber: undefined }));
            }}
            placeholder={accountPlaceholder}
            placeholderTextColor={FinColors.textMuted}
            style={styles.textInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {accountHelperText ? (
            <Text style={styles.fieldHint}>{accountHelperText}</Text>
          ) : null}
          {fieldErrors.accountNumber ? (
            <Text style={styles.fieldErrorText}>{fieldErrors.accountNumber}</Text>
          ) : null}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Type rekening</Text>
          <View style={styles.dropdownWrap}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAccountTypeDropdown((current) => !current)}
              style={({ pressed }) => [
                styles.dropdownTrigger,
                showAccountTypeDropdown && styles.dropdownTriggerOpen,
                pressed && styles.dropdownTriggerPressed,
              ]}
            >
              <Text style={styles.dropdownTriggerText}>{ACCOUNT_TYPE_LABELS[kind]}</Text>
              <AppIcon
                name={showAccountTypeDropdown ? "expand-less" : "expand-more"}
                size={20}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </Pressable>
            {showAccountTypeDropdown ? (
              <View style={styles.dropdownMenu}>
                {SIMPLE_ACCOUNT_KIND_OPTIONS.map((type) => {
                  const selected = kind === type;
                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      onPress={() => {
                        setKind(type);
                        if (type === "business" || type === "investment") {
                          setUsage("exclude");
                          setExcludeFromNetWorth(true);
                        }
                        setShowAccountTypeDropdown(false);
                      }}
                      style={({ pressed }) => [
                        styles.dropdownOption,
                        selected && styles.dropdownOptionSelected,
                        pressed && styles.dropdownOptionPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dropdownOptionText,
                          selected && styles.dropdownOptionTextSelected,
                        ]}
                      >
                        {ACCOUNT_TYPE_LABELS[type]}
                      </Text>
                      {selected ? (
                        <AppIcon
                          name="check"
                          size={18}
                          color={FinColors.warningText}
                          variant="outlined"
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.sectionLabel}>Hoe wil je deze rekening gebruiken in Budio?</Text>
          <View style={styles.scopeSegmentTrack}>
            {SIMPLE_USAGE_OPTIONS.map((option) => {
              const active = usage === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => {
                    setUsage(option.value);
                    if (option.value !== "exclude") {
                      setExcludeFromNetWorth(false);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.scopeSegmentItem,
                    active ? styles.scopeSegmentItemActive : null,
                    pressed ? styles.scopeSegmentItemPressed : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.scopeSegmentLabel,
                      active ? styles.scopeSegmentLabelActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.sectionHint}>
            Samen betekent overal je gedeelde huishoudcontext.
          </Text>
        </View>

        {usage === "exclude" ? (
          <View style={styles.fieldBlock}>
            <Text style={styles.sectionLabel}>Niet meenemen</Text>
            <View style={styles.toggleCard}>
              <View style={styles.toggleRowCard}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.fieldLabel}>Toch meetellen in totaal vermogen</Text>
                  <Text style={styles.toggleSubtitle}>
                    Zet aan als dit saldo wel in je totaalplaatje hoort.
                  </Text>
                </View>
                <Switch
                  value={!excludeFromNetWorth}
                  onValueChange={(value) => setExcludeFromNetWorth(!value)}
                  trackColor={{ false: FinColors.switchTrackOff, true: FinColors.switchTrackOn }}
                  thumbColor={!excludeFromNetWorth ? FinColors.warningText : FinColors.switchThumbOff}
                  ios_backgroundColor={FinColors.switchTrackOff}
                />
              </View>
            </View>
          </View>
        ) : null}

        {showActiveToggle ? (
          <View style={styles.fieldBlock}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAdvancedOpen((current) => !current)}
              style={({ pressed }) => [
                styles.advancedToggle,
                pressed ? styles.advancedTogglePressed : null,
              ]}
            >
              <Text style={styles.advancedToggleText}>Extra opties</Text>
              <AppIcon
                name={advancedOpen ? "expand-less" : "expand-more"}
                size={20}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </Pressable>
            {advancedOpen ? (
              <View style={styles.advancedCard}>
                <View style={styles.toggleRowCard}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.fieldLabel}>Rekening actief</Text>
                    <Text style={styles.toggleSubtitle}>
                      Zet uit om deze rekening te archiveren en uit actieve keuzes te halen.
                    </Text>
                  </View>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: "#d7d7d7", true: "#f1d96a" }}
                    thumbColor={isActive ? FinColors.warningText : "#f4f4f4"}
                    ios_backgroundColor="#d7d7d7"
                  />
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.fieldBlock}>
          <Text style={styles.sectionLabel}>In het kort</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <AppIcon
                name="info"
                size={16}
                color={FinColors.warningText}
                variant="outlined"
              />
              <Text style={styles.summaryTitle}>In het kort</Text>
            </View>
            <Text style={styles.summaryText}>{liveSummary}</Text>
          </View>
        </View>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}
      </ScrollView>
    </FinanceBottomSheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minHeight: 0,
  },
  footer: {
    marginTop: 18,
  },
  footerActions: {
    gap: 10,
  },
  scrollContent: {
    paddingBottom: 10,
    gap: 16,
  },
  infoCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 16,
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 20,
    lineHeight: 24,
    color: FinColors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  fieldBlock: {
    gap: 10,
  },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  sectionLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  scopeSegmentTrack: {
    flexDirection: "row",
    gap: 6,
    padding: 4,
    borderRadius: 18,
    backgroundColor: "rgba(17,17,17,0.06)",
  },
  scopeSegmentItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  scopeSegmentItemActive: {
    backgroundColor: FinColors.bgBase,
  },
  scopeSegmentItemPressed: {
    opacity: 0.85,
  },
  scopeSegmentLabel: {
    fontSize: 13,
    lineHeight: 16,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  scopeSegmentLabelActive: {
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  fieldHint: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textMuted,
  },
  fieldErrorText: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.red,
    fontWeight: "600",
  },
  toggleCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    overflow: "hidden",
  },
  toggleRowCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(17,17,17,0.08)",
  },
  toggleTextWrap: {
    flex: 1,
    gap: 4,
  },
  toggleSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  advancedToggle: {
    borderRadius: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  advancedTogglePressed: {
    opacity: 0.8,
  },
  advancedToggleText: {
    fontSize: 16,
    lineHeight: 20,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  advancedCard: {
    gap: 14,
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    padding: 14,
  },
  summaryCard: {
    backgroundColor: FinColors.warningBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.warningText,
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: FinColors.warningText,
    fontWeight: "600",
  },
  textInput: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 20,
    color: FinColors.textPrimary,
  },
  dropdownWrap: {
    gap: 8,
  },
  dropdownTrigger: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dropdownTriggerOpen: {
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  dropdownTriggerPressed: {
    opacity: 0.86,
  },
  dropdownTriggerText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  dropdownMenu: {
    borderRadius: 18,
    backgroundColor: FinColors.bgCard,
    overflow: "hidden",
  },
  dropdownOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dropdownOptionSelected: {
    backgroundColor: FinColors.warningBg,
  },
  dropdownOptionPressed: {
    opacity: 0.86,
  },
  dropdownOptionText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  dropdownOptionTextSelected: {
    color: FinColors.warningText,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.red,
    fontWeight: "600",
  },
  saveButton: {
    borderRadius: 999,
    backgroundColor: FinColors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonPressed: {
    opacity: 0.88,
  },
  saveButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.bgBase,
    fontWeight: "800",
  },
  deleteButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.redBg,
    backgroundColor: FinColors.bgCard,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteButtonPressed: {
    opacity: 0.86,
  },
  deleteButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.red,
    fontWeight: "700",
  },
});
