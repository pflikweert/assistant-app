/**
 * Shared label contracts for UI copy fragments.
 * Keep render trees dumb: selectors/services decide meaning, UI only renders labels.
 */

export type UnknownLabel = "Onbekend" | "Nog niet bekend";

export function fallbackLabel(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Onbekend";
}

export function boolLabel(value: boolean, truthy: string, falsy: string): string {
  return value ? truthy : falsy;
}

export type BudgetInclusionTone = "included" | "excluded";

export function getBudgetInclusionTogglePresentation(budgetExcluded: boolean): {
  iconName: "check-circle-outline" | "remove-circle-outline";
  label: "Binnen" | "Buiten";
  tone: BudgetInclusionTone;
} {
  if (budgetExcluded) {
    return {
      iconName: "remove-circle-outline",
      label: "Buiten",
      tone: "excluded",
    };
  }

  return {
    iconName: "check-circle-outline",
    label: "Binnen",
    tone: "included",
  };
}

type ReserveBreakdownLike = {
  reservedInAccountsNow?: number | null;
  reservedProtectedInOperationalNow?: number | null;
  annualObligationMonthlyTotal?: number | null;
  savingsTargetMonthly?: number | null;
};

type AnnualRuleLike = {
  monthlyAmount?: number | null;
  status?: "active" | "paused" | string;
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clampMoney(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return round2(Math.max(value, 0));
}

export function buildAnnualReserveSheetSummary(input: {
  reserveBreakdown?: ReserveBreakdownLike | null;
  currentReservedBalanceAmount?: number | null;
  annualRules?: AnnualRuleLike[] | null;
}) {
  const reserveBreakdown = input.reserveBreakdown || null;
  const activeRules = (input.annualRules || []).filter(
    (rule) => rule.status === "active",
  );
  const annualFromRules = round2(
    activeRules.reduce((total, rule) => {
      const amount = Number(rule.monthlyAmount || 0);
      if (!Number.isFinite(amount)) return total;
      return total + Math.max(amount, 0);
    }, 0),
  );

  const annualObligationMonthly = clampMoney(
    reserveBreakdown?.annualObligationMonthlyTotal,
  );
  const annualActive = annualObligationMonthly ?? annualFromRules;

  const reservedProtectedInOperational = clampMoney(
    reserveBreakdown?.reservedProtectedInOperationalNow,
  );
  const savingsTargetMonthly = clampMoney(reserveBreakdown?.savingsTargetMonthly);
  const bufferReserved = reservedProtectedInOperational ?? savingsTargetMonthly;

  const reservedInAccounts = clampMoney(reserveBreakdown?.reservedInAccountsNow);
  const reserveBreakdownTotal =
    reservedInAccounts == null && reservedProtectedInOperational == null
      ? null
      : round2(
          Math.max(reservedInAccounts || 0, 0) +
            Math.max(reservedProtectedInOperational || 0, 0),
        );
  const currentReservedBalance = clampMoney(input.currentReservedBalanceAmount);
  const totalReserved = currentReservedBalance ?? reserveBreakdownTotal;

  return {
    totalReserved,
    bufferReserved,
    reservedInAccounts,
    annualActive,
    savingsTargetMonthly,
    reservedProtectedInOperational,
  };
}
