import { resolveForecastAccountRules } from "@/services/forecast-account-rules";
import type { BankAccount } from "@/services/bank-accounts";
import type { ForecastOwnerScope } from "@/services/forecast-domain";

// `MoneyViewScope` is the app-level finance preference. It is separate from
// `owner_scope` on the account itself.
export const MONEY_VIEW_SCOPES = [
  "personal",
  "shared",
  "household",
  "observation",
] as const;

export type MoneyViewScope = (typeof MONEY_VIEW_SCOPES)[number];

export function normalizeMoneyViewScope(
  value: unknown,
  fallback: MoneyViewScope = "personal",
): MoneyViewScope {
  const normalized = String(value || "")
    .toLowerCase()
    .trim();
  if (
    MONEY_VIEW_SCOPES.includes(normalized as (typeof MONEY_VIEW_SCOPES)[number])
  ) {
    return normalized as MoneyViewScope;
  }
  return fallback;
}

export function getMoneyViewScopeLabel(scope: MoneyViewScope): string {
  switch (scope) {
    case "shared":
      return "Samen";
    case "household":
      return "Huishouden";
    case "observation":
      return "Observatie";
    case "personal":
    default:
      return "Persoonlijk";
  }
}

export function resolveVisibleMoneyViewScopes(params: {
  hasObservationAccounts: boolean;
  currentScope: MoneyViewScope;
}): readonly MoneyViewScope[] {
  const { hasObservationAccounts, currentScope } = params;
  if (hasObservationAccounts || currentScope === "observation") {
    return MONEY_VIEW_SCOPES;
  }
  return MONEY_VIEW_SCOPES.filter((scope) => scope !== "observation");
}

export type MoneyViewScopeAccountLike = Pick<
  BankAccount,
  | "account_type"
  | "forecast_role"
  | "include_in_budget"
  | "include_in_cashflow"
  | "include_in_net_worth"
  | "owner_scope"
  | "is_active"
  | "name"
  | "provider"
>;

function isMeaningfulMoneyViewAccount(
  account: MoneyViewScopeAccountLike,
  scope: Exclude<MoneyViewScope, "observation">,
) {
  const rules = resolveAccountRules(account);
  if (scope === "personal") return rules.owner_scope === "personal";
  if (scope === "shared") return rules.owner_scope === "shared";
  return rules.owner_scope === "child";
}

function hasObservationMoneyViewAccount(account: MoneyViewScopeAccountLike) {
  const rules = resolveAccountRules(account);
  // Observation is only relevant as a top-level view when there are accounts
  // that are explicitly external/observational in ownership semantics.
  return rules.owner_scope === "external";
}

export function resolveAvailableMoneyViewScopes(
  accounts: readonly MoneyViewScopeAccountLike[],
  currentScope: MoneyViewScope = "personal",
): readonly MoneyViewScope[] {
  const hasMeaningfulPersonal = accounts.some((account) =>
    isMeaningfulMoneyViewAccount(account, "personal"),
  );
  const hasMeaningfulShared = accounts.some((account) =>
    isMeaningfulMoneyViewAccount(account, "shared"),
  );
  const hasMeaningfulHousehold = accounts.some((account) =>
    isMeaningfulMoneyViewAccount(account, "household"),
  );
  const hasObservation = accounts.some((account) =>
    hasObservationMoneyViewAccount(account),
  );

  const visibleScopes: MoneyViewScope[] = [];
  if (hasMeaningfulPersonal) {
    visibleScopes.push("personal");
  }
  if (hasMeaningfulShared) {
    visibleScopes.push("shared");
  }
  if (hasMeaningfulHousehold) {
    visibleScopes.push("household");
  }

  if (hasObservation && (visibleScopes.length > 1 || currentScope === "observation")) {
    visibleScopes.push("observation");
  }

  if (!visibleScopes.length) {
    // Personal is the safe default view. Even when no broader view is
    // meaningful, the app should still open on the personal context instead of
    // ending up on an empty or stale scope.
    visibleScopes.push("personal");
  }

  return visibleScopes;
}

function resolveMoneyViewScopeOwnerScopes(
  scope: MoneyViewScope,
): ForecastOwnerScope[] {
  if (scope === "shared") return ["personal", "shared"];
  if (scope === "household") return ["personal", "shared", "child"];
  if (scope === "observation") return ["external"];
  return ["personal"];
}

function resolveAccountRules(account: Pick<
  BankAccount,
  | "account_type"
  | "forecast_role"
  | "include_in_budget"
  | "include_in_cashflow"
  | "include_in_net_worth"
  | "owner_scope"
  | "is_active"
  | "name"
  | "provider"
>) {
  return resolveForecastAccountRules(account);
}

export function isAccountIncludedInMoneyViewScope(
  account: Pick<
    BankAccount,
    | "account_type"
    | "forecast_role"
    | "include_in_budget"
    | "include_in_cashflow"
    | "include_in_net_worth"
    | "owner_scope"
    | "is_active"
    | "name"
    | "provider"
  >,
  scope: MoneyViewScope,
) {
  const rules = resolveAccountRules(account);
  if (scope === "observation") {
    // Observation is read-only in the UI, but still intentionally supported as
    // a filtered view over external/observation accounts.
    return (
      rules.owner_scope === "external" ||
      rules.forecast_role === "observation_only" ||
      rules.forecast_role === "excluded"
    );
  }

  return resolveMoneyViewScopeOwnerScopes(scope).includes(rules.owner_scope);
}

export function isAccountIncludedInOperationalMoneyViewScope(
  account: Pick<
    BankAccount,
    | "account_type"
    | "forecast_role"
    | "include_in_budget"
    | "include_in_cashflow"
    | "include_in_net_worth"
    | "owner_scope"
    | "is_active"
    | "name"
    | "provider"
  >,
  scope: MoneyViewScope,
) {
  if (!isAccountIncludedInMoneyViewScope(account, scope)) return false;
  if (scope === "observation") return false;

  const rules = resolveAccountRules(account);
  if (!rules.include_in_cashflow) return false;
  return rules.forecast_role === "operational" || rules.forecast_role === "shared";
}

export function isAccountIncludedInBudgetMoneyViewScope(
  account: Pick<
    BankAccount,
    | "account_type"
    | "forecast_role"
    | "include_in_budget"
    | "include_in_cashflow"
    | "include_in_net_worth"
    | "owner_scope"
    | "is_active"
    | "name"
    | "provider"
  >,
  scope: MoneyViewScope,
) {
  if (!isAccountIncludedInMoneyViewScope(account, scope)) return false;
  if (scope === "observation") return false;

  const rules = resolveAccountRules(account);
  if (!rules.include_in_budget) return false;
  return (
    rules.forecast_role === "operational" ||
    rules.forecast_role === "shared" ||
    rules.forecast_role === "reserve" ||
    rules.forecast_role === "goal"
  );
}

export function isAccountIncludedInNetWorthMoneyViewScope(
  account: Pick<
    BankAccount,
    | "account_type"
    | "forecast_role"
    | "include_in_budget"
    | "include_in_cashflow"
    | "include_in_net_worth"
    | "owner_scope"
    | "is_active"
    | "name"
    | "provider"
  >,
  scope: MoneyViewScope,
) {
  const rules = resolveAccountRules(account);

  if (scope === "observation") {
    return (
      rules.owner_scope === "external" ||
      rules.forecast_role === "observation_only" ||
      rules.forecast_role === "excluded"
    );
  }

  if (!isAccountIncludedInMoneyViewScope(account, scope)) return false;
  return rules.include_in_net_worth !== false;
}
