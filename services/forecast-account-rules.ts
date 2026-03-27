import type { BankAccountType } from "@/services/bank-accounts";
import {
  type ForecastAccountRole,
  type ForecastOwnerScope,
} from "@/services/forecast-domain";

export type ForecastAccountRules = {
  forecast_role: ForecastAccountRole;
  include_in_cashflow: boolean;
  include_in_budget: boolean;
  include_in_net_worth: boolean;
  owner_scope: ForecastOwnerScope;
};

export type ForecastAccountRuleInput = {
  account_type?: BankAccountType | string | null;
  provider?: string | null;
  name?: string | null;
  forecast_role?: ForecastAccountRole | null;
  include_in_cashflow?: boolean | null;
  include_in_budget?: boolean | null;
  include_in_net_worth?: boolean | null;
  owner_scope?: ForecastOwnerScope | null;
  is_active?: boolean | null;
};

function normalize(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .trim();
}

function hasAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value));
}

export function resolveForecastOwnerScope(
  input: ForecastAccountRuleInput,
): ForecastOwnerScope {
  if (input.owner_scope) return input.owner_scope;

  const text = normalize(`${input.name || ""} ${input.provider || ""}`);
  if (hasAny(text, ["gezamenlijk", "joint", "shared", "huishoud", "partner"])) {
    return "shared";
  }
  if (hasAny(text, ["kind", "child", "jeugd", "kids", "zakgeld"])) {
    return "child";
  }

  if (input.account_type === "credit" || input.account_type === "loan") {
    return "external";
  }

  return "personal";
}

export function resolveForecastAccountRole(
  input: ForecastAccountRuleInput,
): ForecastAccountRole {
  if (input.forecast_role) return input.forecast_role;

  if (input.is_active === false) return "observation_only";

  const accountType = normalize(input.account_type);
  if (accountType === "savings") return "reserve";
  if (accountType === "investment") return "goal";
  if (accountType === "credit" || accountType === "loan") return "excluded";

  const ownerScope = resolveForecastOwnerScope(input);
  if (ownerScope === "shared") return "shared";

  return "operational";
}

export function resolveForecastAccountRules(
  input: ForecastAccountRuleInput,
): ForecastAccountRules {
  const forecastRole = resolveForecastAccountRole(input);
  const ownerScope = resolveForecastOwnerScope(input);
  const includeInBudget =
    input.include_in_budget ??
    (forecastRole === "operational" ||
      forecastRole === "shared" ||
      forecastRole === "child");
  const includeInCashflow =
    input.include_in_cashflow ??
    (forecastRole === "operational" || forecastRole === "shared");
  const includeInNetWorth =
    input.include_in_net_worth ??
    true;

  return {
    forecast_role: forecastRole,
    include_in_cashflow: Boolean(includeInCashflow),
    include_in_budget: Boolean(includeInBudget),
    include_in_net_worth: Boolean(includeInNetWorth),
    owner_scope: ownerScope,
  };
}

export function applyForecastAccountRules<
  T extends ForecastAccountRuleInput,
>(account: T): T & ForecastAccountRules {
  return {
    ...account,
    ...resolveForecastAccountRules(account),
  };
}

