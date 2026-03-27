import { BankAccountFormSheet } from "@/components/bank-accounts/bank-account-form-sheet";
import { ForecastAccountMeta } from "@/components/bank-accounts/forecast-account-meta";
import { AppIcon } from "@/components/ui/app-icon";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinColors, FinSurfaces } from "@/constants/theme";
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

function getStatusLabel(account: BankAccount) {
  if (!account.is_active) return "Gearchiveerd";
  if (account.include_in_budget === false) return "Alleen overzicht";
  return "In budget";
}

function getStatusTone(account: BankAccount) {
  if (!account.is_active) return "muted" as const;
  if (account.include_in_budget === false) return "watch" as const;
  return "good" as const;
}

function formatDeleteCountLabel(count: number | null) {
  if (count == null) return "We controleren hoeveel transacties gekoppeld zijn.";
  if (count === 0) return "Er zijn geen gekoppelde transacties gevonden.";
  if (count === 1) return "We verwijderen ook 1 gekoppelde transactie van deze rekening.";
  return `We verwijderen ook ${count} gekoppelde transacties van deze rekening.`;
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "good" | "watch" | "muted";
}) {
  return (
    <View
      style={[
        styles.statusChip,
        tone === "good"
          ? styles.statusChipGood
          : tone === "watch"
            ? styles.statusChipWatch
            : styles.statusChipMuted,
      ]}
    >
      <Text
        style={[
          styles.statusChipText,
          tone === "good"
            ? styles.statusChipTextGood
            : tone === "watch"
              ? styles.statusChipTextWatch
              : styles.statusChipTextMuted,
        ]}
      >
        {label}
      </Text>
    </View>
  );
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
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDetailTopBar title="Bankrekeningen" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentMax}>
          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Beheer</Text>
            <Text style={styles.heroTitle}>Je bankrekeningen</Text>
            <Text style={styles.heroText}>
              Voeg rekeningen toe, werk ze bij en bepaal welke meetellen in je budget.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowCreateSheet(true)}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <AppIcon name="add" size={18} color={FinColors.bgBase} variant="outlined" />
              <Text style={styles.primaryButtonText}>Nieuwe rekening toevoegen</Text>
            </Pressable>
          </View>

          {screenError ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Let op</Text>
              <Text style={styles.errorText}>{screenError}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={FinColors.warningText} />
              <Text style={styles.stateText}>Bankrekeningen laden…</Text>
            </View>
          ) : sortedAccounts.length ? (
            sortedAccounts.map((account) => {
              const cardTone = getCardTone(account);
              return (
                <View
                  key={account.id}
                  style={[
                    styles.accountCard,
                    cardTone === "good"
                      ? styles.accountCardGood
                      : cardTone === "watch"
                        ? styles.accountCardWatch
                        : styles.accountCardMuted,
                  ]}
                >
                  <View style={styles.accountCardHeader}>
                    <Text style={styles.accountTypeLabel}>
                      {ACCOUNT_TYPE_LABELS[account.account_type].toUpperCase()}
                    </Text>
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
                        <AppIcon name="edit" size={16} color={FinColors.textSecondary} variant="outlined" />
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
                        <AppIcon name="delete-outline" size={16} color={FinColors.red} variant="outlined" />
                      </Pressable>
                    </View>
                  </View>

                  <Text style={styles.accountName}>{account.name}</Text>

                  <View style={styles.providerRow}>
                    <View style={styles.accountBadge}>
                      <AppIcon
                        name="account-balance"
                        size={18}
                        color={FinColors.warningText}
                        variant="outlined"
                      />
                    </View>
                    <Text style={styles.providerName}>
                      {account.provider || "Onbekende aanbieder"}
                    </Text>
                  </View>

                  <Text style={styles.accountNumberText}>
                    {account.account_masked || "Geen rekeningnummer bekend"}
                  </Text>

                  <ForecastAccountMeta account={account} variant="chips" />

                  <View style={styles.accountCardFooter}>
                    <StatusChip
                      label={getStatusLabel(account)}
                      tone={getStatusTone(account)}
                    />
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <AppIcon name="manage-accounts" size={34} color={FinColors.warningText} variant="outlined" />
              <Text style={styles.emptyTitle}>Nog geen bankrekeningen</Text>
              <Text style={styles.emptyText}>
                Voeg je eerste rekening toe om budget, overzicht en imports beter te sturen.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowCreateSheet(true)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <AppIcon name="add" size={18} color={FinColors.bgBase} variant="outlined" />
                <Text style={styles.primaryButtonText}>Nieuwe rekening toevoegen</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

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
    gap: 10,
  },
  heroEyebrow: {
    fontSize: 12,
    color: FinColors.warningText,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
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
  primaryButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: FinColors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.bgBase,
    fontWeight: "800",
  },
  errorCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 16,
    gap: 6,
  },
  errorTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  stateCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 18,
    gap: 10,
    alignItems: "center",
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  accountCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 18,
    gap: 12,
  },
  accountCardGood: {
    backgroundColor: FinColors.bgCard,
  },
  accountCardWatch: {
    backgroundColor: FinColors.bgCard,
  },
  accountCardMuted: {
    backgroundColor: FinColors.bgCard,
  },
  accountCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  accountTypeLabel: {
    fontSize: 12,
    lineHeight: 15,
    color: FinColors.textMuted,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  accountHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconActionButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(17,17,17,0.06)",
  },
  accountBadge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.05)",
  },
  accountName: {
    fontSize: 18,
    lineHeight: 24,
    color: FinColors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  providerName: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  accountNumberText: {
    fontSize: 13,
    lineHeight: 18,
    color: "#4f4a44",
    fontWeight: "700",
    letterSpacing: 1.8,
  },
  accountCardFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  statusChipGood: {
    backgroundColor: "#e7f3a8",
  },
  statusChipWatch: {
    backgroundColor: FinColors.warningBg,
  },
  statusChipMuted: {
    backgroundColor: "rgba(17,17,17,0.08)",
  },
  statusChipText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "900",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  statusChipTextGood: {
    color: "#5b6a1b",
  },
  statusChipTextWatch: {
    color: FinColors.warningText,
  },
  statusChipTextMuted: {
    color: FinColors.textSecondary,
  },
  emptyCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 20,
    gap: 10,
    alignItems: "flex-start",
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  deleteSheetBody: {
    marginTop: 20,
  },
  deleteSheetFooter: {
    marginTop: 20,
  },
  deleteSheetActions: {
    gap: 10,
  },
  deleteInfoCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 18,
    gap: 10,
  },
  deleteInfoIcon: {
    width: 50,
    height: 50,
    borderRadius: 999,
    backgroundColor: FinColors.redBg,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteInfoTitle: {
    fontSize: 18,
    lineHeight: 23,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  deleteInfoText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  deleteLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteErrorText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.red,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  confirmDeleteButton: {
    borderRadius: 999,
    backgroundColor: FinColors.red,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  confirmDeleteButtonPressed: {
    opacity: 0.88,
  },
  confirmDeleteButtonText: {
    fontSize: 14,
    lineHeight: 18,
    color: FinColors.bgBase,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.86,
  },
});
