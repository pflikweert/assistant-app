import { BankAccountFormSheet } from "@/components/bank-accounts/bank-account-form-sheet";
import {
  formatAccountMaskedNumber,
  formatAccountOverviewSummary,
  formatAccountOwnerContext,
} from "@/components/bank-accounts/account-overview-summary";
import { AppIcon } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import { FinColors, FinFontWeight, FinRadius, FinSpacing, FinTokens, FinTypography } from "@/constants/theme";
import {
  deleteBankAccountWithTransactions,
  getBankAccountTransactionCount,
  listBankAccounts,
  type BankAccount,
} from "@/services/bank-accounts";
import { markForecastDirty } from "@/services/forecast-refresh";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const ACCOUNT_TYPE_LABELS: Record<BankAccount["account_type"], string> = {
  checking: "Betaalrekening",
  savings: "Spaarrekening",
  business: "Zakelijke rekening",
  credit: "Creditcard",
  loan: "Lening",
  investment: "Beleggingsrekening",
  cash: "Contant",
  other: "Overig",
};

function formatDeleteCountLabel(count: number | null) {
  if (count == null) return "We controleren hoeveel transacties gekoppeld zijn.";
  if (count === 0) return "Er zijn geen gekoppelde transacties gevonden.";
  if (count === 1) return "We verwijderen ook 1 gekoppelde transactie van deze rekening.";
  return `We verwijderen ook ${count} gekoppelde transacties van deze rekening.`;
}

type DeleteConfirmSheetProps = {
  visible: boolean;
  account: BankAccount | null;
  transactionCount: number | null;
  loadingCount: boolean;
  deleting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteConfirmSheet({
  visible,
  account,
  transactionCount,
  loadingCount,
  deleting,
  errorMessage,
  onClose,
  onConfirm,
}: DeleteConfirmSheetProps) {
  return (
    <FinanceBottomSheetShell
      visible={visible}
      title="Rekening verwijderen"
      subtitle={
        account
          ? `${account.name}${account.provider ? ` · ${account.provider}` : ""}`
          : "Verwijder deze rekening en de gekoppelde transacties."
      }
      onClose={onClose}
      bodyStyle={styles.deleteSheetBody}
      footerStyle={styles.deleteSheetFooter}
      footer={
        <View style={styles.deleteSheetActions}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
          >
            <Text style={styles.cancelButtonText}>Annuleren</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            disabled={deleting}
            style={({ pressed }) => [
              styles.confirmDeleteButton,
              (deleting || pressed) && styles.confirmDeleteButtonPressed,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={FinColors.bgBase} />
            ) : (
              <>
                <AppIcon name="delete-outline" size={18} color={FinColors.bgBase} variant="outlined" />
                <Text style={styles.confirmDeleteButtonText}>Verwijderen</Text>
              </>
            )}
          </Pressable>
        </View>
      }
    >
      <View style={styles.deleteInfoCard}>
        <View style={styles.deleteInfoIcon}>
          <AppIcon name="warning-amber" size={26} color={FinColors.red} variant="outlined" />
        </View>
        <Text style={styles.deleteInfoTitle}>Deze actie kan niet ongedaan worden gemaakt.</Text>
        {loadingCount ? (
          <View style={styles.deleteLoadingRow}>
            <ActivityIndicator size="small" color={FinColors.warningText} />
            <Text style={styles.deleteInfoText}>Aantal gekoppelde transacties laden…</Text>
          </View>
        ) : (
          <Text style={styles.deleteInfoText}>{formatDeleteCountLabel(transactionCount)}</Text>
        )}
        <Text style={styles.deleteInfoText}>
          Daarna verdwijnt deze rekening ook uit je overzicht en budget.
        </Text>
        {errorMessage ? <Text style={styles.deleteErrorText}>{errorMessage}</Text> : null}
      </View>
    </FinanceBottomSheetShell>
  );
}

function getCardTone(account: BankAccount): "good" | "watch" | "muted" {
  if (!account.is_active) return "muted";
  if (account.include_in_budget === false) return "watch";
  return "good";
}

function formatAccountStatusLabel(account: BankAccount): string {
  if (!account.is_active) return "Verborgen";
  if (account.include_in_budget === false) return "Alleen overzicht";
  return "In budget";
}

export default function BankrekeningenScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [accounts, setAccounts] = React.useState<BankAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [screenError, setScreenError] = React.useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<BankAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = React.useState<BankAccount | null>(null);
  const [deleteCount, setDeleteCount] = React.useState<number | null>(null);
  const [deleteCountLoading, setDeleteCountLoading] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const loadAccounts = React.useCallback(async () => {
    setLoading(true);
    setScreenError(null);
    try {
      const nextAccounts = await listBankAccounts();
      setAccounts(nextAccounts);
    } catch (error) {
      setScreenError(
        error instanceof Error
          ? error.message
          : "We konden je bankrekeningen niet laden.",
      );
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!isFocused) return;
    void loadAccounts();
  }, [isFocused, loadAccounts]);

  React.useEffect(() => {
    if (!deletingAccount) {
      setDeleteCount(null);
      setDeleteCountLoading(false);
      setDeleteError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setDeleteCountLoading(true);
      setDeleteError(null);
      try {
        const count = await getBankAccountTransactionCount(deletingAccount.id);
        if (cancelled) return;
        setDeleteCount(count);
      } catch (error) {
        if (cancelled) return;
        setDeleteError(
          error instanceof Error
            ? error.message
            : "We konden het aantal gekoppelde transacties niet laden.",
        );
      } finally {
        if (!cancelled) {
          setDeleteCountLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deletingAccount]);

  const sortedAccounts = React.useMemo(() => {
    return [...accounts].sort((left, right) => {
      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1;
      }
      if ((left.include_in_budget !== false) !== (right.include_in_budget !== false)) {
        return left.include_in_budget !== false ? -1 : 1;
      }
      return left.name.localeCompare(right.name, "nl");
    });
  }, [accounts]);

  const handleAccountSaved = React.useCallback(async (account: BankAccount) => {
    setAccounts((current) => {
      const existingIndex = current.findIndex((item) => item.id === account.id);
      if (existingIndex === -1) {
        return [account, ...current];
      }
      const next = [...current];
      next[existingIndex] = account;
      return next;
    });

    await markForecastDirty("forecast_backfill").catch((error) => {
      console.warn("[bankrekeningen] forecast dirty mark after save failed", error);
    });
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deletingAccount) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteBankAccountWithTransactions(deletingAccount.id);
      setAccounts((current) =>
        current.filter((account) => account.id !== deletingAccount.id),
      );
      setDeletingAccount(null);
      setDeleteCount(null);
      await markForecastDirty("forecast_backfill").catch((error) => {
        console.warn("[bankrekeningen] forecast dirty mark after delete failed", error);
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "We konden de rekening niet verwijderen.",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [deletingAccount]);

  return (
    <FinanceUtilityShell
      title="Bankrekeningen"
      onBack={() => router.back()}
      contentContainerStyle={styles.content}
    >
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Beheer je rekeningen</Text>
        <Text style={styles.heroText}>
          Beheer welke rekeningen Budio gebruikt voor budget en overzicht.
        </Text>
      </View>

      {loading ? (
        <View style={styles.listWrap}>
          {[0, 1, 2].map((index) => (
            <View
              key={`loading-row-${index}`}
              style={[styles.loadingRow, index === 2 ? styles.rowLast : null]}
            >
              <View style={styles.loadingLineLong} />
              <View style={styles.loadingLineMedium} />
              <View style={styles.loadingLineShort} />
              <View style={styles.loadingActions} />
              <View style={styles.loadingBadge} />
            </View>
          ))}
        </View>
      ) : null}

      {!loading && screenError ? (
        <View style={styles.errorCard}>
          <View style={styles.errorIconWrap}>
            <AppIcon name="warning-amber" size={FinTokens.icon.lg} color={FinColors.red} variant="outlined" />
          </View>
          <Text style={styles.errorTitle}>Fout bij laden van rekeningen</Text>
          <Text style={styles.errorText}>{screenError}</Text>
          <FinanceButton
            label="Probeer opnieuw"
            fullWidth
            onPress={() => void loadAccounts()}
            leftIcon={<AppIcon name="refresh" size={FinTokens.icon.sm} color={FinColors.textPrimary} variant="outlined" />}
          />
        </View>
      ) : null}

      {!loading && !screenError && sortedAccounts.length ? (
        <View style={styles.listWrap}>
          {sortedAccounts.map((account, index) => {
            const cardTone = getCardTone(account);
            const ownerContext = formatAccountOwnerContext(account.owner_scope);
            const summary = formatAccountOverviewSummary(account);
            const statusLabel = formatAccountStatusLabel(account);
            return (
              <View
                key={account.id}
                style={[styles.accountRow, index === sortedAccounts.length - 1 ? styles.rowLast : null]}
              >
                <View style={styles.accountRowTop}>
                  <View style={styles.accountMain}>
                    <View style={styles.accountLogoBubble}>
                      <AppIcon name="account-balance" size={FinTokens.icon.sm} color={FinColors.textSecondary} variant="outlined" />
                    </View>
                    <View style={styles.accountTitleWrap}>
                      <View style={styles.accountTitleLine}>
                        <Text style={styles.accountName}>{account.name}</Text>
                        <View
                          style={[
                            styles.statusChip,
                            cardTone === "good"
                              ? styles.statusChipGood
                              : cardTone === "watch"
                                ? styles.statusChipWatch
                                : styles.statusChipMuted,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusChipText,
                              cardTone === "good"
                                ? styles.statusChipTextGood
                                : cardTone === "watch"
                                  ? styles.statusChipTextWatch
                                  : styles.statusChipTextMuted,
                            ]}
                          >
                            {statusLabel}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.accountTypeLabel}>
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                      </Text>
                      <Text style={styles.providerLine}>
                        {account.provider || "Onbekende aanbieder"} · {formatAccountMaskedNumber(account.account_masked)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.accountHeaderActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rekening bewerken"
                      onPress={() => setEditingAccount(account)}
                      style={({ pressed }) => [
                        styles.iconActionButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppIcon name="edit" size={FinTokens.icon.sm} color={FinColors.textSecondary} variant="outlined" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Rekening verwijderen"
                      onPress={() => setDeletingAccount(account)}
                      style={({ pressed }) => [
                        styles.iconActionButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <AppIcon name="delete-outline" size={FinTokens.icon.sm} color={FinColors.red} variant="outlined" />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.accountFooter}>
                  <Text style={styles.accountSummary}>{summary}</Text>
                  <View style={styles.accountFooterLeft}>
                    {ownerContext ? (
                      <View style={styles.contextChip}>
                        <Text style={styles.contextChipText}>{ownerContext}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {!loading && !screenError && !sortedAccounts.length ? (
        <View style={styles.emptyCard}>
          <View style={styles.errorIconWrap}>
            <AppIcon name="account-balance" size={FinTokens.icon.lg} color={FinColors.textSecondary} variant="outlined" />
          </View>
          <Text style={styles.emptyTitle}>Nog geen rekeningen gekoppeld.</Text>
          <Text style={styles.emptyText}>
            Koppel je eerste bankrekening om direct inzicht in overzicht, budget en vooruitblik te krijgen.
          </Text>
        </View>
      ) : null}

      <FinanceButton
        label="Nieuwe rekening"
        fullWidth
        onPress={() => setShowCreateSheet(true)}
        style={styles.createButton}
        leftIcon={<AppIcon name="add" size={FinTokens.icon.sm} color={FinColors.textPrimary} variant="outlined" />}
      />

      <BankAccountFormSheet
        visible={showCreateSheet}
        mode="create"
        title="Nieuwe rekening"
        subtitle="Voeg een rekening toe en bepaal hoe die meetelt in je overzicht."
        showActiveToggle
        onClose={() => setShowCreateSheet(false)}
        onSaved={(account) => {
          void handleAccountSaved(account);
        }}
      />

      <BankAccountFormSheet
        visible={Boolean(editingAccount)}
        mode="edit"
        account={editingAccount}
        title="Rekening bewerken"
        subtitle="Werk naam, type en instellingen van deze rekening bij."
        showActiveToggle
        onClose={() => setEditingAccount(null)}
        onSaved={(account) => {
          setEditingAccount(null);
          void handleAccountSaved(account);
        }}
      />

      <DeleteConfirmSheet
        visible={Boolean(deletingAccount)}
        account={deletingAccount}
        transactionCount={deleteCount}
        loadingCount={deleteCountLoading}
        deleting={isDeleting}
        errorMessage={deleteError}
        onClose={() => {
          if (isDeleting) return;
          setDeletingAccount(null);
        }}
        onConfirm={() => void handleDeleteConfirm()}
      />
    </FinanceUtilityShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: FinSpacing["4xl"],
    gap: FinSpacing.m,
  },
  heroTitle: {
    ...FinTypography["title-sm"],
    color: FinColors.textPrimary,
    fontWeight: FinFontWeight.extrabold,
  },
  heroText: {
    ...FinTypography["body-sm"],
    color: FinColors.textSecondary,
  },
  heroSection: {
    backgroundColor: FinColors.bgCard,
    borderRadius: FinRadius.xl,
    padding: FinSpacing.l,
    gap: FinSpacing.s,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  listWrap: {
    backgroundColor: FinColors.bgCard,
    borderRadius: FinRadius.xl,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    overflow: "hidden",
  },
  accountRow: {
    paddingHorizontal: FinSpacing.m,
    paddingVertical: FinSpacing["s-plus"],
    gap: FinSpacing.s,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  accountRowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: FinSpacing.s,
  },
  accountMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: FinSpacing.s,
  },
  accountLogoBubble: {
    width: FinTokens.icon.xl + FinSpacing.x2,
    height: FinTokens.icon.xl + FinSpacing.x2,
    borderRadius: FinRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgInput,
    marginTop: FinSpacing.x1,
  },
  accountTitleWrap: {
    flex: 1,
    gap: FinSpacing.xs,
  },
  accountTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  accountName: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: FinFontWeight.bold,
  },
  accountTypeLabel: {
    ...FinTypography.caption,
    color: FinColors.textMuted,
    fontWeight: FinFontWeight.bold,
    textTransform: "uppercase",
  },
  providerLine: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: FinFontWeight.medium,
    marginTop: FinSpacing.x1,
  },
  accountFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.s,
    marginTop: FinSpacing.x1,
  },
  accountSummary: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    flex: 1,
  },
  accountFooterLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.xs,
  },
  statusChip: {
    borderRadius: FinRadius.pill,
    paddingVertical: FinSpacing.x1,
    paddingHorizontal: FinSpacing.xs,
  },
  statusChipGood: {
    backgroundColor: FinColors.statusGoodBg,
  },
  statusChipWatch: {
    backgroundColor: FinColors.bgElevated,
  },
  statusChipMuted: {
    backgroundColor: FinColors.surfaceSoft,
  },
  statusChipText: {
    ...FinTypography.caption,
    fontWeight: FinFontWeight.bold,
    textTransform: "uppercase",
  },
  statusChipTextGood: {
    color: FinColors.statusGoodText,
  },
  statusChipTextWatch: {
    color: FinColors.textSecondary,
  },
  statusChipTextMuted: {
    color: FinColors.textMuted,
  },
  accountHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x1,
  },
  iconActionButton: {
    width: FinTokens.icon.xl + FinSpacing.x2,
    height: FinTokens.icon.xl + FinSpacing.x2,
    borderRadius: FinRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgInput,
  },
  contextChip: {
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.xs,
    paddingVertical: FinSpacing.x1,
  },
  contextChipText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: FinFontWeight.bold,
  },
  loadingRow: {
    paddingHorizontal: FinSpacing.m,
    paddingVertical: FinSpacing.s,
    gap: FinSpacing.x1,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  loadingLineLong: {
    width: "68%",
    height: FinSpacing.s,
    borderRadius: FinRadius.sm,
    backgroundColor: FinColors.bgElevated,
  },
  loadingLineMedium: {
    width: "52%",
    height: FinSpacing.xs,
    borderRadius: FinRadius.sm,
    backgroundColor: FinColors.bgInput,
  },
  loadingLineShort: {
    width: "38%",
    height: FinSpacing.xs,
    borderRadius: FinRadius.sm,
    backgroundColor: FinColors.bgInput,
  },
  loadingActions: {
    width: "18%",
    height: FinSpacing.s,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgInput,
    alignSelf: "flex-end",
    marginTop: FinSpacing.x1,
  },
  loadingBadge: {
    width: "30%",
    height: FinSpacing.s,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgElevated,
    marginTop: FinSpacing.x1,
  },
  errorCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: FinRadius.xl,
    padding: FinSpacing.l,
    gap: FinSpacing.s,
    borderWidth: 1,
    borderColor: FinColors.redBorder,
    alignItems: "center",
  },
  errorIconWrap: {
    width: FinTokens.icon.xl + FinSpacing.m,
    height: FinTokens.icon.xl + FinSpacing.m,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.redBg,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTitle: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: FinFontWeight.bold,
  },
  errorText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: FinRadius.xl,
    padding: FinSpacing.l,
    gap: FinSpacing.s,
    alignItems: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  emptyTitle: {
    ...FinTypography["title-sm"],
    color: FinColors.textPrimary,
    fontWeight: FinFontWeight.bold,
    textAlign: "center",
  },
  emptyText: {
    ...FinTypography["body-sm"],
    color: FinColors.textSecondary,
    textAlign: "center",
  },
  createButton: {
    marginTop: FinSpacing.xs,
  },
  deleteSheetBody: {
    marginTop: FinSpacing.m,
  },
  deleteSheetFooter: {
    marginTop: FinSpacing.m,
  },
  deleteSheetActions: {
    gap: FinSpacing.xs,
  },
  deleteInfoCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: FinRadius.xxl,
    padding: FinSpacing.m,
    gap: FinSpacing.xs,
  },
  deleteInfoIcon: {
    width: FinTokens.icon.xl + FinSpacing.l,
    height: FinTokens.icon.xl + FinSpacing.l,
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.redBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteInfoTitle: {
    ...FinTypography.body,
    color: FinColors.textPrimary,
    fontWeight: FinFontWeight.extrabold,
  },
  deleteInfoText: {
    ...FinTypography["body-sm"],
    color: FinColors.textSecondary,
  },
  deleteLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.xs,
  },
  deleteErrorText: {
    ...FinTypography.caption,
    color: FinColors.red,
    fontWeight: FinFontWeight.semibold,
  },
  cancelButton: {
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.bgElevated,
    paddingVertical: FinSpacing.s,
    paddingHorizontal: FinSpacing.m,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: FinFontWeight.bold,
  },
  confirmDeleteButton: {
    borderRadius: FinRadius.pill,
    backgroundColor: FinColors.red,
    paddingVertical: FinSpacing.s,
    paddingHorizontal: FinSpacing.m,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: FinSpacing.x2,
  },
  confirmDeleteButtonPressed: {
    opacity: 0.88,
  },
  confirmDeleteButtonText: {
    ...FinTypography["body-sm"],
    color: FinColors.bgBase,
    fontWeight: FinFontWeight.extrabold,
  },
  pressed: {
    opacity: 0.86,
  },
});
