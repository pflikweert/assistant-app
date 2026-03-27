import { AppIcon } from "@/components/ui/app-icon";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinColors } from "@/constants/theme";
import {
  ACCOUNT_TYPES,
  createBankAccount,
  updateBankAccount,
  type BankAccount,
  type BankAccountType,
} from "@/services/bank-accounts";
import {
  resolveForecastAccountRules,
  type ForecastAccountRules,
} from "@/services/forecast-account-rules";
import type { ForecastAccountRole, ForecastOwnerScope } from "@/services/forecast-domain";
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
  credit: "Creditcard",
  loan: "Lening",
  investment: "Belegging",
  cash: "Contant",
  other: "Overig",
};

const OWNER_SCOPE_OPTIONS: { value: ForecastOwnerScope; label: string }[] = [
  { value: "personal", label: "Persoonlijk" },
  { value: "shared", label: "Samen" },
  { value: "child", label: "Kind" },
  { value: "external", label: "Extern" },
];

const FORECAST_ROLE_OPTIONS: { value: ForecastAccountRole; label: string }[] = [
  { value: "operational", label: "Operationeel" },
  { value: "reserve", label: "Reserve" },
  { value: "goal", label: "Doel" },
  { value: "shared", label: "Gedeeld" },
  { value: "observation_only", label: "Alleen bekijken" },
  { value: "excluded", label: "Uitgesloten" },
];

type BankAccountFormMeaningState = {
  ownerScope: ForecastOwnerScope;
  includeInBudget: boolean;
  includeInNetWorth: boolean;
  includeInCashflow: boolean;
  forecastRole: ForecastAccountRole;
};

function getScopeLabel(scope: ForecastOwnerScope): string {
  switch (scope) {
    case "shared":
      return "samen";
    case "child":
      return "kind";
    case "external":
      return "extern";
    case "personal":
    default:
      return "persoonlijk";
  }
}

export function buildLiveSummaryText(input: BankAccountFormMeaningState) {
  const scopeLabel = getScopeLabel(input.ownerScope);
  const usages: string[] = [];
  if (input.includeInBudget) usages.push("budgetten");
  if (input.includeInNetWorth) usages.push("totale vermogen");
  if (input.includeInCashflow) usages.push("vooruitzichten");

  if (!usages.length) {
    return `Deze rekening (${scopeLabel}) telt nu niet mee in budget, vermogen of vooruitzichten.`;
  }

  if (usages.length === 1) {
    return `Deze rekening (${scopeLabel}) wordt gebruikt voor je ${usages[0]}.`;
  }

  if (usages.length === 2) {
    return `Deze rekening (${scopeLabel}) wordt gebruikt voor je ${usages[0]} en ${usages[1]}.`;
  }

  return `Deze rekening (${scopeLabel}) wordt gebruikt voor je ${usages[0]}, je ${usages[1]} en ${usages[2]}.`;
}

export function isForecastToggleRelevant(input: {
  ownerScope: ForecastOwnerScope;
  accountType: BankAccountType;
  forecastRole: ForecastAccountRole;
}) {
  if (input.ownerScope === "external") return false;
  if (input.accountType === "credit" || input.accountType === "loan") return false;
  return (
    input.forecastRole !== "excluded" &&
    input.forecastRole !== "observation_only"
  );
}

export function resolveDefaultsForCreate(
  accountType: BankAccountType,
): ForecastAccountRules {
  if (accountType === "savings") {
    return resolveForecastAccountRules({
      account_type: accountType,
      owner_scope: "personal",
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: true,
      forecast_role: "reserve",
    });
  }

  return resolveForecastAccountRules({
    account_type: accountType,
    owner_scope: "personal",
    include_in_budget: true,
    include_in_cashflow: true,
    include_in_net_worth: true,
    forecast_role: "operational",
  });
}

export function buildBankAccountFormInitialMeaning(params: {
  mode: BankAccountFormMode;
  accountType: BankAccountType;
  account?: BankAccount | null;
}) {
  const { mode, accountType, account } = params;
  if (mode === "edit" && account) {
    const rules = resolveForecastAccountRules({
      account_type: account.account_type,
      provider: account.provider,
      name: account.name,
      owner_scope: account.owner_scope,
      forecast_role: account.forecast_role,
      include_in_budget: account.include_in_budget,
      include_in_cashflow: account.include_in_cashflow,
      include_in_net_worth: account.include_in_net_worth,
      is_active: account.is_active,
    });
    return rules;
  }
  return resolveDefaultsForCreate(accountType);
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
  const [accountType, setAccountType] = React.useState<BankAccountType>("checking");
  const [showAccountTypeDropdown, setShowAccountTypeDropdown] = React.useState(false);
  const [showForecastRoleDropdown, setShowForecastRoleDropdown] = React.useState(false);
  const [ownerScope, setOwnerScope] = React.useState<ForecastOwnerScope>("personal");
  const [forecastRole, setForecastRole] = React.useState<ForecastAccountRole>("operational");
  const [includeInBudget, setIncludeInBudget] = React.useState(true);
  const [includeInNetWorth, setIncludeInNetWorth] = React.useState(true);
  const [includeInCashflow, setIncludeInCashflow] = React.useState(true);
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
    setAccountType(isEdit ? account?.account_type || "checking" : "checking");
    const initialMeaning = buildBankAccountFormInitialMeaning({
      mode,
      accountType: isEdit ? account?.account_type || "checking" : "checking",
      account,
    });
    setOwnerScope(initialMeaning.owner_scope);
    setForecastRole(initialMeaning.forecast_role);
    setIncludeInBudget(initialMeaning.include_in_budget);
    setIncludeInNetWorth(initialMeaning.include_in_net_worth);
    setIncludeInCashflow(initialMeaning.include_in_cashflow);
    setIsActive(isEdit ? Boolean(account?.is_active) : true);
    setAdvancedOpen(false);
    setShowAccountTypeDropdown(false);
    setShowForecastRoleDropdown(false);
    setSaving(false);
    setFieldErrors({});
    setSubmitError(null);
  }, [account, isEdit, mode, providerLabel, sourceAccountNumber, visible]);

  React.useEffect(() => {
    if (!visible || isEdit) return;
    const defaults = resolveDefaultsForCreate(accountType);
    setOwnerScope(defaults.owner_scope);
    setForecastRole(defaults.forecast_role);
    setIncludeInBudget(defaults.include_in_budget);
    setIncludeInNetWorth(defaults.include_in_net_worth);
    setIncludeInCashflow(defaults.include_in_cashflow);
  }, [accountType, isEdit, visible]);

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
  const forecastRelevant = isForecastToggleRelevant({
    ownerScope,
    accountType,
    forecastRole,
  });
  const liveSummary = buildLiveSummaryText({
    ownerScope,
    includeInBudget,
    includeInNetWorth,
    includeInCashflow: forecastRelevant ? includeInCashflow : false,
    forecastRole,
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
      const savedAccount = isEdit
        ? await updateBankAccount({
            id: account?.id || "",
            name: trimmedName,
            provider: trimmedProvider || null,
            accountType,
            includeInBudget,
            includeInNetWorth,
            includeInCashflow: forecastRelevant ? includeInCashflow : false,
            ownerScope,
            forecastRole,
            isActive,
            ...(trimmedAccountNumber ? { accountNumber: trimmedAccountNumber } : {}),
          })
        : await createBankAccount({
            name: trimmedName,
            accountType,
            provider: trimmedProvider || providerLabel || null,
            accountNumber: trimmedAccountNumber || null,
            includeInBudget,
            includeInNetWorth,
            includeInCashflow: forecastRelevant ? includeInCashflow : false,
            ownerScope,
            forecastRole,
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
    accountNumber,
    accountType,
    includeInBudget,
    includeInCashflow,
    includeInNetWorth,
    isActive,
    isEdit,
    name,
    ownerScope,
    onClose,
    onSaved,
    provider,
    providerLabel,
    forecastRelevant,
    forecastRole,
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
              <Text style={styles.dropdownTriggerText}>{ACCOUNT_TYPE_LABELS[accountType]}</Text>
              <AppIcon
                name={showAccountTypeDropdown ? "expand-less" : "expand-more"}
                size={20}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </Pressable>
            {showAccountTypeDropdown ? (
              <View style={styles.dropdownMenu}>
                {ACCOUNT_TYPES.map((type) => {
                  const selected = accountType === type;
                  return (
                    <Pressable
                      key={type}
                      accessibilityRole="button"
                      onPress={() => {
                        setAccountType(type);
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
          <Text style={styles.sectionLabel}>Eigenaarschap</Text>
          <View style={styles.scopeSegmentTrack}>
            {OWNER_SCOPE_OPTIONS.map((option) => {
              const active = ownerScope === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  onPress={() => setOwnerScope(option.value)}
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
            Bepaalt in welke financiele ruimtes deze rekening zichtbaar is.
          </Text>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.sectionLabel}>Waar telt deze rekening mee?</Text>
          <View style={styles.toggleCard}>
            <View style={styles.toggleRowCard}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.fieldLabel}>Meenemen in budget</Text>
                <Text style={styles.toggleSubtitle}>
                  Gebruiken voor je dagelijkse uitgaven.
                </Text>
              </View>
              <Switch
                value={includeInBudget}
                onValueChange={setIncludeInBudget}
                trackColor={{ false: "#d7d7d7", true: "#f1d96a" }}
                thumbColor={includeInBudget ? FinColors.warningText : "#f4f4f4"}
                ios_backgroundColor="#d7d7d7"
              />
            </View>
            <View style={styles.toggleRowCard}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.fieldLabel}>Meenemen in vermogen</Text>
                <Text style={styles.toggleSubtitle}>
                  Het saldo optellen bij je totaalplaatje.
                </Text>
              </View>
              <Switch
                value={includeInNetWorth}
                onValueChange={setIncludeInNetWorth}
                trackColor={{ false: "#d7d7d7", true: "#f1d96a" }}
                thumbColor={includeInNetWorth ? FinColors.warningText : "#f4f4f4"}
                ios_backgroundColor="#d7d7d7"
              />
            </View>
            {forecastRelevant ? (
              <View style={styles.toggleRowCard}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.fieldLabel}>Meenemen in forecast</Text>
                  <Text style={styles.toggleSubtitle}>
                    Budio kijkt vooruit met dit saldo.
                  </Text>
                </View>
                <Switch
                  value={includeInCashflow}
                  onValueChange={setIncludeInCashflow}
                  trackColor={{ false: "#d7d7d7", true: "#f1d96a" }}
                  thumbColor={includeInCashflow ? FinColors.warningText : "#f4f4f4"}
                  ios_backgroundColor="#d7d7d7"
                />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAdvancedOpen((current) => !current)}
            style={({ pressed }) => [
              styles.advancedToggle,
              pressed ? styles.advancedTogglePressed : null,
            ]}
          >
            <Text style={styles.advancedToggleText}>Geavanceerde opties</Text>
            <AppIcon
              name={advancedOpen ? "expand-less" : "expand-more"}
              size={20}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          </Pressable>
          {advancedOpen ? (
            <View style={styles.advancedCard}>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Rol in forecast</Text>
                <View style={styles.dropdownWrap}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowForecastRoleDropdown((current) => !current)}
                    style={({ pressed }) => [
                      styles.dropdownTrigger,
                      showForecastRoleDropdown && styles.dropdownTriggerOpen,
                      pressed && styles.dropdownTriggerPressed,
                    ]}
                  >
                    <Text style={styles.dropdownTriggerText}>
                      {
                        FORECAST_ROLE_OPTIONS.find((option) => option.value === forecastRole)
                          ?.label
                      }
                    </Text>
                    <AppIcon
                      name={showForecastRoleDropdown ? "expand-less" : "expand-more"}
                      size={20}
                      color={FinColors.textSecondary}
                      variant="outlined"
                    />
                  </Pressable>
                  {showForecastRoleDropdown ? (
                    <View style={styles.dropdownMenu}>
                      {FORECAST_ROLE_OPTIONS.map((option) => {
                        const selected = forecastRole === option.value;
                        return (
                          <Pressable
                            key={option.value}
                            accessibilityRole="button"
                            onPress={() => {
                              setForecastRole(option.value);
                              setShowForecastRoleDropdown(false);
                            }}
                            style={({ pressed }) => [
                              styles.dropdownOption,
                              selected ? styles.dropdownOptionSelected : null,
                              pressed ? styles.dropdownOptionPressed : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dropdownOptionText,
                                selected ? styles.dropdownOptionTextSelected : null,
                              ]}
                            >
                              {option.label}
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
              {showActiveToggle ? (
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
              ) : null}
            </View>
          ) : null}
        </View>

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
