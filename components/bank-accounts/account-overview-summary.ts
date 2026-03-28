import type { BankAccount } from "@/services/bank-accounts";

const ACCOUNT_NUMBER_FALLBACK = "Rekeningnummer niet bekend";

export function formatAccountMaskedNumber(masked: string | null | undefined): string {
  const value = String(masked || "").trim();
  return value || ACCOUNT_NUMBER_FALLBACK;
}

export function formatAccountOwnerContext(scope: BankAccount["owner_scope"]): string | null {
  switch (scope) {
    case "shared":
      return "Samen";
    case "child":
      return "Kind";
    case "external":
      return "Extern";
    case "personal":
    default:
      return null;
  }
}

export function formatAccountOverviewSummary(account: BankAccount): string {
  const includeBudget = account.include_in_budget !== false;
  const includeNetWorth = account.include_in_net_worth !== false;
  const includeCashflow = account.include_in_cashflow !== false;

  if (!account.is_active) return "Niet actief in budget";
  if (!includeBudget && !includeNetWorth && !includeCashflow) return "Alleen overzicht";

  if (
    account.owner_scope === "shared" &&
    account.forecast_role !== "excluded" &&
    !includeBudget &&
    includeNetWorth &&
    !includeCashflow
  ) {
    return "Gedeelde overzichtsrekening";
  }

  if (
    account.account_type === "savings" &&
    !includeBudget &&
    includeNetWorth &&
    !includeCashflow
  ) {
    return "Alleen voor vermogen";
  }

  if (!includeBudget && includeNetWorth) return "Alleen voor vermogen";
  if (includeBudget && includeNetWorth) return "Gebruikt voor budget en vermogen";
  if (includeBudget) return "Gebruikt voor budget";
  if (includeCashflow) return "Alleen voor vooruitzichten";
  return "Alleen overzicht";
}
