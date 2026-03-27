export const FORECAST_ACCOUNT_ROLES = [
  "operational",
  "reserve",
  "goal",
  "shared",
  "observation_only",
  "excluded",
] as const;

export type ForecastAccountRole = (typeof FORECAST_ACCOUNT_ROLES)[number];

export const FORECAST_EVENT_TYPES = [
  "income",
  "expense",
  "internal_transfer",
  "reserve_allocation",
  "correction",
] as const;

export type ForecastEventType = (typeof FORECAST_EVENT_TYPES)[number];

export const FORECAST_TIMELINE_STORAGE_EVENT_TYPES = [
  "income",
  "fixed_cost",
  "subscription",
  "savings_transfer",
  "milestone_lowest_balance",
] as const;

export type ForecastTimelineStorageEventType =
  (typeof FORECAST_TIMELINE_STORAGE_EVENT_TYPES)[number];

export const FORECAST_CERTAINTIES = [
  "booked",
  "committed",
  "inferred",
  "estimated",
] as const;
export type ForecastCertainty = (typeof FORECAST_CERTAINTIES)[number];

export const FORECAST_MONEY_LAYERS = [
  "operational",
  "reserved",
  "net_worth",
  "free_to_spend",
] as const;

export type ForecastMoneyLayer = (typeof FORECAST_MONEY_LAYERS)[number];

export const FORECAST_MONTH_STATES = [
  "unknown",
  "observed",
  "projected",
  "settled",
  "stressed",
] as const;

export type ForecastMonthStatus = (typeof FORECAST_MONTH_STATES)[number];

export type ForecastCarryover = {
  sourceMonthStart: string | null;
  targetMonthStart: string | null;
  sourceMoneyLayer: ForecastMoneyLayer;
  targetMoneyLayer: ForecastMoneyLayer;
  amount: number;
  certainty: ForecastCertainty;
  sourceEventType: ForecastEventType;
  sourceLabel: string | null;
  reason: string | null;
};

export type ForecastEvent = {
  id: string;
  date: string;
  type: ForecastEventType;
  certainty: ForecastCertainty;
  moneyLayer: ForecastMoneyLayer;
  amount: number;
  label: string;
  accountRole: ForecastAccountRole;
  ownerScope: ForecastOwnerScope;
  timelineKind?: "income" | "fixed_cost" | "subscription" | "savings_transfer" | null;
  timelineSource?:
    | "income_source"
    | "recurring_history"
    | "subscription_profile"
    | "rare_subscription"
    | "derived"
    | null;
  carryover?: ForecastCarryover | null;
  referenceId?: string | null;
  sourceLabel?: string | null;
};

export type ForecastLayerBalanceSnapshot = {
  operational: number | null;
  reserved: number | null;
  netWorth: number | null;
};

export const FORECAST_OWNER_SCOPES = [
  "personal",
  "shared",
  "child",
  "external",
] as const;

export type ForecastOwnerScope = (typeof FORECAST_OWNER_SCOPES)[number];

export type ForecastMonthState = {
  monthStart: string;
  referenceDate: string | null;
  currentBalanceDate: string | null;
  status: ForecastMonthStatus;
  openingOperationalBalance: number | null;
  openingReservedBalance: number | null;
  openingNetWorth: number | null;
  currentBalance: number | null;
  reservedBalance: number | null;
  netWorth: number | null;
  freeToSpend: number | null;
  expectedIncome: number | null;
  expectedExpenses: number | null;
  expectedInternalTransfers: number | null;
  expectedReserveAllocations: number | null;
  expectedEndOperationalBalance: number | null;
  expectedEndReservedBalance: number | null;
  expectedEndNetWorth: number | null;
  freeToSpendCarryover: number | null;
  expectedEndBalance: number | null;
  lowestExpectedBalance: number | null;
  lowestExpectedBalanceDate: string | null;
  nextExpectedEventDate: string | null;
  nextExpectedEventLabel: string | null;
  expectedIncomeTotal: number | null;
  remainingExpectedIncomeTotal: number | null;
  remainingExpectedExpenseTotal: number | null;
  remainingExpectedSavingsOutflowTotal: number | null;
  upcomingCommittedIncomeTotal: number | null;
  upcomingCommittedExpenseTotal: number | null;
  expectedFixedCosts: number | null;
  expectedSubscriptions: number | null;
  expectedVariableCosts: number | null;
  riskFlag: "none" | "deficit_warning";
  cashRiskFlag: "none" | "cash_gap_warning";
  certainty: ForecastCertainty;
  carryover: ForecastCarryover | null;
  events: ForecastEvent[];
};

function normalizeToken(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

export function normalizeForecastEventType(
  value: unknown,
  fallback: ForecastEventType = "correction",
): ForecastEventType {
  const normalized = normalizeToken(value);
  if (
    FORECAST_EVENT_TYPES.includes(
      normalized as (typeof FORECAST_EVENT_TYPES)[number],
    )
  ) {
    return normalized as ForecastEventType;
  }
  return fallback;
}

export function normalizeForecastMoneyLayer(
  value: unknown,
  fallback: ForecastMoneyLayer = "operational",
): ForecastMoneyLayer {
  const normalized = normalizeToken(value);
  if (
    FORECAST_MONEY_LAYERS.includes(
      normalized as (typeof FORECAST_MONEY_LAYERS)[number],
    )
  ) {
    return normalized as ForecastMoneyLayer;
  }
  return fallback;
}

export function normalizeForecastCertainty(
  value: unknown,
  fallback: ForecastCertainty = "estimated",
): ForecastCertainty {
  const normalized = normalizeToken(value);
  if (
    FORECAST_CERTAINTIES.includes(
      normalized as (typeof FORECAST_CERTAINTIES)[number],
    )
  ) {
    return normalized as ForecastCertainty;
  }
  if (normalized === "high") return "booked";
  if (normalized === "medium") return "committed";
  if (normalized === "low") return "inferred";
  return fallback;
}
