import type { BankAccount, BankAccountType } from "@/services/bank-accounts";
import type { ForecastAccountRole, ForecastOwnerScope } from "@/services/forecast-domain";

export type SimpleAccountUsage = "personal" | "shared" | "exclude";
export type SimpleAccountKind = "checking" | "savings" | "business" | "investment";

export type SimpleAccountSettings = {
  usage: SimpleAccountUsage;
  kind: SimpleAccountKind;
  excludeFromNetWorth: boolean;
};

export type LegacyAccountMeaning = {
  accountType: BankAccountType;
  ownerScope: ForecastOwnerScope;
  forecastRole: ForecastAccountRole;
  includeInBudget: boolean;
  includeInCashflow: boolean;
  includeInNetWorth: boolean;
};

function isBusinessLabelHint(input: {
  name?: string | null;
  provider?: string | null;
}) {
  const text = `${input.name || ""} ${input.provider || ""}`.toLowerCase();
  return (
    text.includes("zakelijk") ||
    text.includes("business") ||
    text.includes("ondernem")
  );
}

function isIncludedInSteering(input: {
  forecastRole?: ForecastAccountRole | null;
  includeInBudget?: boolean | null;
  includeInCashflow?: boolean | null;
}) {
  if (input.forecastRole === "excluded" || input.forecastRole === "observation_only") {
    return false;
  }
  return input.includeInBudget !== false || input.includeInCashflow !== false;
}

export function toSimpleAccountKind(accountType?: BankAccountType | null): SimpleAccountKind {
  if (accountType === "savings") return "savings";
  if (accountType === "business") return "business";
  if (accountType === "investment") return "investment";
  return "checking";
}

export function resolveSimpleAccountSettingsFromLegacy(
  account: Pick<
    BankAccount,
    | "account_type"
    | "owner_scope"
    | "forecast_role"
    | "include_in_budget"
    | "include_in_cashflow"
    | "include_in_net_worth"
    | "name"
    | "provider"
  >,
): SimpleAccountSettings {
  const kindFromType = toSimpleAccountKind(account.account_type);
  const included = isIncludedInSteering({
    forecastRole: account.forecast_role,
    includeInBudget: account.include_in_budget,
    includeInCashflow: account.include_in_cashflow,
  });
  const isExcluded = !included;
  const inferredBusiness =
    isExcluded &&
    kindFromType === "checking" &&
    isBusinessLabelHint({
      name: account.name,
      provider: account.provider,
    });
  const kind = inferredBusiness ? "business" : kindFromType;

  const usage: SimpleAccountUsage = !included
    ? "exclude"
    : account.owner_scope === "shared"
      ? "shared"
      : "personal";

  return {
    usage,
    kind,
    excludeFromNetWorth: account.include_in_net_worth === false,
  };
}

export function resolveDefaultSimpleUsageForKind(kind: SimpleAccountKind): SimpleAccountUsage {
  if (kind === "business" || kind === "investment") return "exclude";
  return "personal";
}

export function resolveDefaultExcludeFromNetWorthForKind(kind: SimpleAccountKind): boolean {
  return kind === "business" || kind === "investment";
}

export function mapSimpleSettingsToLegacyMeaning(params: {
  settings: SimpleAccountSettings;
  currentOwnerScope?: ForecastOwnerScope | null;
}): LegacyAccountMeaning {
  const { settings } = params;
  // DB-compat: current production schema does not accept `business` as
  // account_type yet, so we persist it as checking while keeping business
  // semantics through excluded defaults.
  const accountType: BankAccountType =
    settings.kind === "business" ? "checking" : settings.kind;
  const ownerScope =
    settings.usage === "exclude"
      ? "personal"
      : settings.usage === "shared"
        ? "shared"
        : "personal";

  if (settings.usage === "exclude") {
    return {
      accountType,
      ownerScope,
      forecastRole: "excluded",
      includeInBudget: false,
      includeInCashflow: false,
      includeInNetWorth: !settings.excludeFromNetWorth,
    };
  }

  if (settings.kind === "savings") {
    return {
      accountType,
      ownerScope,
      forecastRole: "reserve",
      includeInBudget: false,
      includeInCashflow: false,
      includeInNetWorth: true,
    };
  }

  const forecastRole: ForecastAccountRole = ownerScope === "shared" ? "shared" : "operational";
  return {
    accountType,
    ownerScope,
    forecastRole,
    includeInBudget: true,
    includeInCashflow: true,
    includeInNetWorth: true,
  };
}
