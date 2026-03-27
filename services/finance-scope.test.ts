import {
  isAccountIncludedInBudgetMoneyViewScope,
  isAccountIncludedInMoneyViewScope,
  isAccountIncludedInNetWorthMoneyViewScope,
  isAccountIncludedInOperationalMoneyViewScope,
  normalizeMoneyViewScope,
  resolveAvailableMoneyViewScopes,
  resolveVisibleMoneyViewScopes,
} from "@/services/finance-scope";
import type { BankAccount } from "@/services/bank-accounts";
import { describe, expect, it } from "vitest";

function buildAccount(
  input: Partial<BankAccount> & Pick<BankAccount, "id" | "account_type">,
): BankAccount {
  return {
    id: input.id,
    name: input.name || input.id,
    account_type: input.account_type,
    provider: input.provider ?? null,
    currency: "EUR",
    account_masked: null,
    is_active: input.is_active ?? true,
    include_in_budget: input.include_in_budget ?? true,
    include_in_cashflow: input.include_in_cashflow ?? true,
    include_in_net_worth: input.include_in_net_worth ?? true,
    forecast_role: input.forecast_role ?? "operational",
    owner_scope: input.owner_scope ?? "personal",
  };
}

describe("finance-scope", () => {
  it("normalizes unknown scopes to personal", () => {
    expect(normalizeMoneyViewScope("")).toBe("personal");
    expect(normalizeMoneyViewScope("shared")).toBe("shared");
  });

  it("treats shared as a joint operating view and household as the broader family view", () => {
    const personal = buildAccount({
      id: "personal",
      account_type: "checking",
      owner_scope: "personal",
    });
    const shared = buildAccount({
      id: "shared",
      account_type: "checking",
      owner_scope: "shared",
      forecast_role: "shared",
    });
    const child = buildAccount({
      id: "child",
      account_type: "checking",
      owner_scope: "child",
    });
    const external = buildAccount({
      id: "external",
      account_type: "checking",
      owner_scope: "external",
      forecast_role: "observation_only",
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: true,
    });

    expect(isAccountIncludedInMoneyViewScope(shared, "shared")).toBe(true);
    expect(isAccountIncludedInMoneyViewScope(personal, "shared")).toBe(true);
    expect(isAccountIncludedInMoneyViewScope(child, "shared")).toBe(false);
    expect(isAccountIncludedInMoneyViewScope(child, "household")).toBe(true);
    expect(isAccountIncludedInMoneyViewScope(external, "observation")).toBe(true);

    expect(isAccountIncludedInOperationalMoneyViewScope(shared, "shared")).toBe(
      true,
    );
    expect(isAccountIncludedInOperationalMoneyViewScope(child, "household")).toBe(
      true,
    );
    expect(isAccountIncludedInBudgetMoneyViewScope(shared, "shared")).toBe(true);
    expect(isAccountIncludedInBudgetMoneyViewScope(external, "observation")).toBe(
      false,
    );
    expect(isAccountIncludedInNetWorthMoneyViewScope(external, "observation")).toBe(
      true,
    );
  });

  it("shows observation only when there are observation accounts or the view is already selected", () => {
    expect(
      resolveVisibleMoneyViewScopes({
        hasObservationAccounts: false,
        currentScope: "personal",
      }),
    ).toEqual(["personal", "shared", "household"]);

    expect(
      resolveVisibleMoneyViewScopes({
        hasObservationAccounts: true,
        currentScope: "personal",
      }),
    ).toEqual(["personal", "shared", "household", "observation"]);

    expect(
      resolveVisibleMoneyViewScopes({
        hasObservationAccounts: false,
        currentScope: "observation",
      }),
    ).toEqual(["personal", "shared", "household", "observation"]);
  });

  it("only exposes meaningful scope views based on the loaded account set", () => {
    const personal = buildAccount({
      id: "personal",
      account_type: "checking",
      owner_scope: "personal",
    });
    const shared = buildAccount({
      id: "shared",
      account_type: "checking",
      owner_scope: "shared",
      forecast_role: "shared",
    });
    const child = buildAccount({
      id: "child",
      account_type: "checking",
      owner_scope: "child",
      forecast_role: "shared",
    });
    const observation = buildAccount({
      id: "obs",
      account_type: "checking",
      owner_scope: "external",
      forecast_role: "observation_only",
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: true,
    });

    expect(resolveAvailableMoneyViewScopes([personal])).toEqual(["personal"]);
    expect(resolveAvailableMoneyViewScopes([personal, shared])).toEqual([
      "personal",
      "shared",
    ]);
    expect(resolveAvailableMoneyViewScopes([personal, shared, child])).toEqual([
      "personal",
      "shared",
      "household",
    ]);
    expect(resolveAvailableMoneyViewScopes([observation])).toEqual([
      "personal",
    ]);
    expect(resolveAvailableMoneyViewScopes([personal, observation])).toEqual([
      "personal",
    ]);
    expect(resolveAvailableMoneyViewScopes([personal, shared, observation])).toEqual([
      "personal",
      "shared",
      "observation",
    ]);
  });

  it("does not expose observation view without external owner_scope accounts", () => {
    const personalExcluded = buildAccount({
      id: "personal-excluded",
      account_type: "checking",
      owner_scope: "personal",
      forecast_role: "excluded",
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: true,
    });
    const shared = buildAccount({
      id: "shared",
      account_type: "checking",
      owner_scope: "shared",
      forecast_role: "shared",
    });

    expect(
      resolveAvailableMoneyViewScopes([personalExcluded, shared], "shared"),
    ).toEqual(["personal", "shared"]);
  });
});
