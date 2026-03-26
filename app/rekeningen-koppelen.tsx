import { AppIcon } from "@/components/ui/app-icon";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { ImportBankAccountSheet } from "@/components/import/import-bank-account-sheet";
import { IMPORT_FLOW_STEPS } from "@/components/import/import-flow-steps";
import {
  linkImportGroupToBankAccount,
  type ImportAccountGroup,
  type ImportLinkedBankAccount,
  useImportFlowState,
  updateCurrentImportDraft,
} from "@/services/import/import-flow-state";
import { hashAccountNumber, listBankAccounts, type BankAccount } from "@/services/bank-accounts";
import { findBankAccountByHash } from "@/services/bank-accounts";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ACCOUNT_TYPE_LABELS: Record<BankAccount["account_type"], string> = {
  checking: "Betaalrekening",
  savings: "Spaarrekening",
  credit: "Creditcard",
  loan: "Lening",
  investment: "Belegging",
  cash: "Contant",
  other: "Overig",
};

function formatLinkedAccountLine(account: ImportLinkedBankAccount): string {
  const typeLabel = ACCOUNT_TYPE_LABELS[account.account_type];
  const provider = account.provider ? ` · ${account.provider}` : "";
  const masked = account.account_masked ? ` · ${account.account_masked}` : "";
  return `${typeLabel}${provider}${masked}`;
}

function getBudgetHint(account: Pick<BankAccount, "include_in_budget">): string | null {
  if (account.include_in_budget === false) {
    return "Telt niet mee in budget";
  }
  return null;
}

function groupIsLinked(group: ImportAccountGroup): boolean {
  return Boolean(group.linkedBankAccount?.id);
}

function getGroupStatusLabel(group: ImportAccountGroup): string {
  if (group.linkedBankAccount && group.linkedBy === "auto") {
    return "Gekoppeld";
  }
  if (group.linkedBankAccount) {
    return "Gekoppeld";
  }
  return "Actie nodig";
}

function getGroupStatusTone(group: ImportAccountGroup) {
  if (group.linkedBankAccount) return "good" as const;
  return "watch" as const;
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "watch";
}) {
  return (
    <View
      style={[
        styles.statusPill,
        tone === "good" ? styles.statusPillGood : styles.statusPillWatch,
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          tone === "good" ? styles.statusPillTextGood : styles.statusPillTextWatch,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

type AccountPickerSheetProps = {
  visible: boolean;
  group: ImportAccountGroup | null;
  bankAccounts: BankAccount[];
  loading: boolean;
  onClose: () => void;
  onSelect: (account: BankAccount) => void;
  onCreateNew: () => void;
};

function AccountPickerSheet({
  visible,
  group,
  bankAccounts,
  loading,
  onClose,
  onSelect,
  onCreateNew,
}: AccountPickerSheetProps) {
  const sortedAccounts = React.useMemo(() => {
    return [...bankAccounts].sort((left, right) => {
      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "nl");
    });
  }, [bankAccounts]);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      title="Kies een rekening"
      subtitle={group ? group.sourceAccountLabel : "Kies de rekening die hierbij past."}
      onClose={onClose}
      bodyStyle={styles.sheetBody}
      footerStyle={styles.sheetFooter}
      footer={
        <Pressable
          accessibilityRole="button"
          onPress={onCreateNew}
          style={({ pressed }) => [styles.sheetCreateButton, pressed && styles.pressed]}
        >
          <Text style={styles.sheetCreateButtonText}>Nieuwe rekening</Text>
          <AppIcon name="add" size={18} color={FinColors.bgBase} variant="outlined" />
        </Pressable>
      }
    >
      {loading ? (
        <View style={styles.sheetLoading}>
          <ActivityIndicator color={FinColors.warningText} />
          <Text style={styles.sheetLoadingText}>Rekeningen laden…</Text>
        </View>
      ) : sortedAccounts.length ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetList}
        >
          {sortedAccounts.map((account) => {
            const inactive = !account.is_active;
            const budgetHint = getBudgetHint(account);
            return (
              <Pressable
                key={account.id}
                accessibilityRole="button"
                onPress={() => onSelect(account)}
                style={({ pressed }) => [
                  styles.sheetRow,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.sheetRowMain}>
                  <Text style={styles.sheetRowTitle}>{account.name}</Text>
                  <Text style={styles.sheetRowSubtitle}>
                    {formatLinkedAccountLine(account)}
                  </Text>
                  {inactive ? (
                    <Text style={styles.sheetRowHint}>Gearchiveerd</Text>
                  ) : budgetHint ? (
                    <Text style={styles.sheetRowHint}>{budgetHint}</Text>
                  ) : null}
                </View>
                <AppIcon
                  name="chevron-right"
                  size={20}
                  color={FinColors.textSecondary}
                  variant="outlined"
                />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.sheetEmpty}>
          <AppIcon name="account-balance" size={34} color={FinColors.warningText} variant="outlined" />
          <Text style={styles.sheetEmptyTitle}>Nog geen bankrekeningen</Text>
          <Text style={styles.sheetEmptyText}>
            Maak eerst een rekening aan om verder te kunnen.
          </Text>
        </View>
      )}
    </FinanceBottomSheetShell>
  );
}

export default function RekeningenKoppelenScreen() {
  const router = useRouter();
  const { draft } = useImportFlowState();
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = React.useState(true);
  const [selectionGroupKey, setSelectionGroupKey] = React.useState<string | null>(null);
  const [createGroupKey, setCreateGroupKey] = React.useState<string | null>(null);
  const [screenError, setScreenError] = React.useState<string | null>(null);
  const autoMatchDraftRef = React.useRef<number | null>(null);

  const selectedGroup = React.useMemo(() => {
    if (!draft || !selectionGroupKey) return null;
    return draft.groups.find((group) => group.key === selectionGroupKey) || null;
  }, [draft, selectionGroupKey]);

  const createGroup = React.useMemo(() => {
    if (!draft || !createGroupKey) return null;
    return draft.groups.find((group) => group.key === createGroupKey) || null;
  }, [createGroupKey, draft]);

  const linkedCount = React.useMemo(() => {
    if (!draft) return 0;
    return draft.groups.filter(groupIsLinked).length;
  }, [draft]);

  const linkedTransactionCount = React.useMemo(() => {
    if (!draft) return 0;
    return draft.groups
      .filter(groupIsLinked)
      .reduce((total, group) => total + group.transactionCount, 0);
  }, [draft]);

  const allLinked = Boolean(draft && draft.groups.length && linkedCount === draft.groups.length);

  React.useEffect(() => {
    let cancelled = false;

    void (async () => {
      setAccountsLoading(true);
      setScreenError(null);
      try {
        const accounts = await listBankAccounts();
        if (cancelled) return;
        setBankAccounts(accounts);
      } catch (error) {
        if (cancelled) return;
        setScreenError(
          error instanceof Error
            ? error.message
            : "We konden je bankrekeningen niet laden.",
        );
      } finally {
        if (!cancelled) {
          setAccountsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!draft) {
      autoMatchDraftRef.current = null;
      return;
    }
    if (autoMatchDraftRef.current === draft.createdAt) return;
    autoMatchDraftRef.current = draft.createdAt;

    let cancelled = false;

    void (async () => {
      const groupsToMatch = draft.groups.filter(
        (group) => group.sourceAccountNumber && !group.linkedBankAccount,
      );
      if (!groupsToMatch.length) return;

      const matches = await Promise.all(
        groupsToMatch.map(async (group) => {
          const hash = await hashAccountNumber(group.sourceAccountNumber as string);
          const bankAccount = await findBankAccountByHash(hash);
          return { groupKey: group.key, bankAccount };
        }),
      );

      if (cancelled) return;

      const matchMap = new Map(
        matches
          .filter((match): match is { groupKey: string; bankAccount: BankAccount } =>
            Boolean(match.bankAccount),
          )
          .map((match) => [match.groupKey, match.bankAccount] as const),
      );

      const nextDraft = updateCurrentImportDraft((current) => {
        if (!current) return current;

        return {
          ...current,
          groups: current.groups.map((group) => {
            const autoMatchedAccount = matchMap.get(group.key);
            if (!autoMatchedAccount || group.linkedBankAccount) {
              return group;
            }
            return {
              ...group,
              linkedBankAccount: autoMatchedAccount,
              linkedBy: "auto",
            };
          }),
        };
      });
      if (!nextDraft) {
        autoMatchDraftRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draft]);

  const handleSelectExisting = React.useCallback(
    (account: BankAccount) => {
      if (!selectedGroup) return;
      linkImportGroupToBankAccount({
        groupKey: selectedGroup.key,
        bankAccount: account,
        linkedBy: "manual",
      });
      setSelectionGroupKey(null);
    },
    [selectedGroup],
  );

  const handleAccountCreated = React.useCallback(
    (account: BankAccount) => {
      if (!createGroup) return;
      linkImportGroupToBankAccount({
        groupKey: createGroup.key,
        bankAccount: account,
        linkedBy: "manual",
      });
      setBankAccounts((current) => [account, ...current]);
      setCreateGroupKey(null);
    },
    [createGroup],
  );

  const linkedSummary = draft
    ? `${linkedTransactionCount} van ${draft.summary.totalTransactions} transacties gekoppeld`
    : "Geen import gevonden";

  const goToImportControl = React.useCallback(() => {
    if (!allLinked) return;
    router.push("/import-control");
  }, [allLinked, router]);

  const goToImportStepOne = React.useCallback(() => {
    router.replace("/csv-import");
  }, [router]);

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDetailTopBar
        title="Rekeningen koppelen"
        onBack={goToImportStepOne}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentMax}>
          <FinanceStepIndicator
            steps={IMPORT_FLOW_STEPS}
            currentStepKey="link-accounts"
            completedStepKeys={["choose-file"]}
          />

          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>Controleer je rekeningen</Text>
            <Text style={styles.heroText}>
              We hebben rekeningen in je bestand gevonden. Kies per rekening de juiste rekening in Budio, of maak er hier een nieuwe voor aan.
            </Text>
          </View>

          {draft ? (
            <View style={styles.summaryCard}>
              <Text style={styles.sectionTitle}>Dit hebben we gevonden</Text>
              <View style={styles.summaryGrid}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Type</Text>
                  <Text style={styles.summaryValue}>{draft.summary.sourceLabel}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Transacties</Text>
                  <Text style={styles.summaryValue}>{draft.summary.totalTransactions}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Rekeningen</Text>
                  <Text style={styles.summaryValue}>{draft.summary.foundAccounts}</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Periode</Text>
                  <Text style={styles.summaryValue}>{draft.summary.periodLabel}</Text>
                </View>
              </View>
              <View style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Klaar om door te gaan</Text>
                  <Text style={styles.progressValue}>{linkedSummary}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${draft.summary.totalTransactions ? (linkedTransactionCount / draft.summary.totalTransactions) * 100 : 0}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <AppIcon name="folder-open" size={34} color={FinColors.warningText} variant="outlined" />
              <Text style={styles.emptyTitle}>Geen import gevonden</Text>
              <Text style={styles.emptyText}>
                Kies opnieuw een bestand om verder te gaan.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={goToImportStepOne}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>Terug naar stap 1</Text>
              </Pressable>
            </View>
          )}

          {screenError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Let op</Text>
              <Text style={styles.errorText}>{screenError}</Text>
            </View>
          ) : null}

          {draft?.groups.map((group) => {
            const linked = group.linkedBankAccount;
            const statusLabel = getGroupStatusLabel(group);
            const statusTone = getGroupStatusTone(group);
            const budgetHint = linked ? getBudgetHint(linked) : null;
            return (
              <View
                key={group.key}
                style={[
                  styles.groupCard,
                  linked ? styles.groupCardLinked : styles.groupCardNeedsAction,
                ]}
              >
                <View style={styles.groupTopRow}>
                  <View
                    style={[
                      styles.accountBadge,
                      linked ? styles.accountBadgeLinked : styles.accountBadgeNeedsAction,
                    ]}
                  >
                    <AppIcon
                      name="account-balance"
                      size={26}
                      color={FinColors.warningText}
                      variant="outlined"
                    />
                  </View>
                  <View style={styles.groupHeaderMain}>
                    <Text style={styles.groupProvider}>{group.providerLabel}</Text>
                    <Text style={styles.groupAccount}>{group.sourceAccountLabel}</Text>
                  </View>
                  <StatusPill label={statusLabel} tone={statusTone} />
                </View>

                {linked ? (
                  <View style={styles.linkedBox}>
                    <View style={styles.linkedInfo}>
                      <Text style={styles.linkedLabel}>Gekoppeld aan</Text>
                      <Text style={styles.linkedName}>{linked.name}</Text>
                      {budgetHint ? (
                        <Text style={styles.linkedHint}>{budgetHint}</Text>
                      ) : null}
                      {!linked.is_active ? (
                        <Text style={styles.linkedHint}>Deze rekening is gearchiveerd.</Text>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Koppeling wijzigen"
                      onPress={() => setSelectionGroupKey(group.key)}
                      style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
                    >
                      <AppIcon
                        name="edit"
                        size={18}
                        color={FinColors.textSecondary}
                        variant="outlined"
                      />
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setCreateGroupKey(group.key)}
                        style={({ pressed }) => [
                          styles.primaryButton,
                          styles.flexButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon name="add" size={16} color={FinColors.textPrimary} variant="outlined" />
                        <Text style={styles.primaryButtonText}>Nieuwe rekening</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setSelectionGroupKey(group.key)}
                        style={({ pressed }) => [
                          styles.secondaryButton,
                          styles.flexButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon name="manage-accounts" size={16} color={FinColors.textSecondary} variant="outlined" />
                        <Text style={styles.secondaryButtonText}>Kies rekening</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            );
          })}

          <View style={styles.footerCard}>
            <Text style={styles.footerTitle}>Transacties inlezen</Text>
            <Text style={styles.footerText}>
              Ga verder zodra elke rekening is gekoppeld.
            </Text>
            <Pressable
              accessibilityRole="button"
              disabled={!allLinked}
              onPress={goToImportControl}
              style={({ pressed }) => [
                styles.primaryWideButton,
                !allLinked && styles.primaryWideButtonDisabled,
                pressed && allLinked && styles.pressed,
              ]}
            >
              <Text style={styles.primaryWideButtonText}>Transacties inlezen</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <AccountPickerSheet
        visible={Boolean(selectedGroup)}
        group={selectedGroup}
        bankAccounts={bankAccounts}
        loading={accountsLoading}
        onClose={() => setSelectionGroupKey(null)}
        onSelect={handleSelectExisting}
        onCreateNew={() => {
          setCreateGroupKey(selectedGroup?.key || null);
          setSelectionGroupKey(null);
        }}
      />

      <ImportBankAccountSheet
        visible={Boolean(createGroup)}
        providerLabel={createGroup?.providerLabel || "Rabobank"}
        sourceAccountNumber={createGroup?.sourceAccountNumber || null}
        sourceAccountLabel={createGroup?.sourceAccountLabel || "Onbekende rekening"}
        onClose={() => setCreateGroupKey(null)}
        onCreated={handleAccountCreated}
      />
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
  },
  content: {
    paddingBottom: 28,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 32,
    gap: 14,
  },
  heroCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  summaryCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryItem: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  progressCard: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: FinColors.borderSubtle,
    paddingTop: 10,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  progressValue: {
    fontSize: 12,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: FinColors.warningText,
  },
  groupCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },
  groupCardLinked: {
    backgroundColor: FinColors.bgCard,
  },
  groupCardNeedsAction: {
    backgroundColor: FinColors.bgCard,
  },
  groupTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  groupHeaderMain: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  accountBadge: {
    width: 46,
    height: 46,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.05)",
    flexShrink: 0,
  },
  accountBadgeLinked: {
    backgroundColor: "#edf4c8",
  },
  accountBadgeNeedsAction: {
    backgroundColor: "#fff0c2",
  },
  groupProvider: {
    fontSize: 15,
    lineHeight: 19,
    color: FinColors.textPrimary,
    fontWeight: "900",
  },
  groupAccount: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  groupMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "700",
  },
  groupHint: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  },
  flexButton: {
    flexGrow: 1,
    minWidth: 160,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.08)",
    backgroundColor: "#ececec",
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
    fontWeight: "800",
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  linkedBox: {
    borderRadius: 18,
    backgroundColor: "rgba(17,17,17,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  linkedInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  linkedLabel: {
    fontSize: 10,
    lineHeight: 12,
    color: FinColors.textMuted,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  linkedName: {
    fontSize: 15,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "900",
  },
  linkedHint: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    flexShrink: 0,
  },
  footerCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 16,
    gap: 10,
  },
  footerTitle: {
    fontSize: 15,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  primaryWideButton: {
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryWideButtonDisabled: {
    opacity: 0.55,
  },
  primaryWideButtonText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  emptyCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  errorCard: {
    backgroundColor: FinColors.redBg,
    borderRadius: 22,
    padding: 16,
    gap: 6,
  },
  errorTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.red,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  pressed: {
    opacity: 0.86,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  statusPillGood: {
    backgroundColor: "#e7f3a8",
  },
  statusPillWatch: {
    backgroundColor: FinColors.warningBg,
  },
  statusPillText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  statusPillTextGood: {
    color: "#5b6a1b",
  },
  statusPillTextWatch: {
    color: FinColors.warningText,
  },
  sheetBody: {
    minHeight: 0,
  },
  sheetFooter: {
    marginTop: 14,
  },
  sheetList: {
    gap: 10,
  },
  sheetRow: {
    borderRadius: 20,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sheetRowMain: {
    flex: 1,
    gap: 4,
  },
  sheetRowTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  sheetRowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  sheetRowHint: {
    fontSize: 12,
    lineHeight: 16,
    color: FinColors.textMuted,
  },
  sheetLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sheetLoadingText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  sheetEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
  },
  sheetEmptyTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  sheetEmptyText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  sheetCreateButton: {
    borderRadius: 999,
    backgroundColor: FinColors.textPrimary,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sheetCreateButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.bgBase,
    fontWeight: "800",
  },
});
