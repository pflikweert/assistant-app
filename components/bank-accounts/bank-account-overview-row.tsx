import { AppIcon } from "@/components/ui/app-icon";
import { FinanceCircleIconButton } from "@/components/ui/finance-circle-icon-button";
import { FinanceStatusChip } from "@/components/ui/finance-status-chip";
import {
  formatAccountMaskedNumber,
  formatAccountOverviewSummary,
  formatAccountOwnerContext,
} from "@/components/bank-accounts/account-overview-summary";
import { FinColors, FinFontWeight, FinRadius, FinSpacing, FinTokens, FinTypography } from "@/constants/theme";
import type { BankAccount } from "@/services/bank-accounts";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

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

function getCardTone(account: BankAccount): "good" | "watch" | "neutral" {
  if (!account.is_active) return "neutral";
  if (account.include_in_budget === false) return "watch";
  return "good";
}

function formatAccountStatusLabel(account: BankAccount): string {
  if (!account.is_active) return "Verborgen";
  if (account.include_in_budget === false) return "Alleen overzicht";
  return "In budget";
}

type BankAccountOverviewRowProps = {
  account: BankAccount;
  isLast: boolean;
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
};

export function BankAccountOverviewRow({
  account,
  isLast,
  onEdit,
  onDelete,
}: BankAccountOverviewRowProps) {
  const ownerContext =
    account.forecast_role === "excluded"
      ? null
      : formatAccountOwnerContext(account.owner_scope);
  const summary = formatAccountOverviewSummary(account);
  const statusLabel = formatAccountStatusLabel(account);

  return (
    <View style={[styles.accountRow, isLast ? styles.rowLast : null]}>
      <View style={styles.accountRowTop}>
        <View style={styles.accountMain}>
          <View style={styles.accountLogoBubble}>
            <AppIcon
              name="account-balance"
              size={FinTokens.icon.sm}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          </View>
          <View style={styles.accountTitleWrap}>
            <View style={styles.accountTitleLine}>
              <Text style={styles.accountName}>{account.name}</Text>
              <FinanceStatusChip
                label={statusLabel}
                tone={getCardTone(account)}
              />
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
          <FinanceCircleIconButton
            icon="edit"
            iconSize={FinTokens.icon.sm}
            iconColor={FinColors.textSecondary}
            accessibilityLabel="Rekening bewerken"
            onPress={() => onEdit(account)}
            style={styles.iconActionButton}
          />
          <FinanceCircleIconButton
            icon="delete-outline"
            iconSize={FinTokens.icon.sm}
            iconColor={FinColors.red}
            accessibilityLabel="Rekening verwijderen"
            onPress={() => onDelete(account)}
            style={styles.iconActionButton}
          />
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
}

const styles = StyleSheet.create({
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
});
