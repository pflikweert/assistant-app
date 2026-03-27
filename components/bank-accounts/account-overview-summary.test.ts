import { describe, expect, it } from "vitest";

import {
  formatAccountMaskedNumber,
  formatAccountOverviewSummary,
  formatAccountOwnerContext,
} from "./account-overview-summary";
import type { BankAccount } from "@/services/bank-accounts";

function buildAccount(overrides?: Partial<BankAccount>): BankAccount {
  return {
    id: "acc_1",
    name: "Betaalrekening",
    account_type: "checking",
    provider: "Rabobank",
    currency: "EUR",
    account_masked: "********9805",
    is_active: true,
    include_in_budget: true,
    include_in_cashflow: true,
    include_in_net_worth: true,
    owner_scope: "personal",
    forecast_role: "operational",
    ...overrides,
  };
}

describe("account-overview-summary", () => {
  it("toont voor persoonlijke betaalrekening een compacte, rustige samenvatting", () => {
    const summary = formatAccountOverviewSummary(buildAccount());
    expect(summary).toBe("Gebruikt voor budget en vermogen");
  });

  it("toont spaarrekening logisch als alleen voor vermogen", () => {
    const summary = formatAccountOverviewSummary(
      buildAccount({
        account_type: "savings",
        include_in_budget: false,
        include_in_cashflow: false,
        include_in_net_worth: true,
      }),
    );
    expect(summary).toBe("Alleen voor vermogen");
  });

  it("toont gedeelde context subtiel zonder technische overload", () => {
    const owner = formatAccountOwnerContext("shared");
    const summary = formatAccountOverviewSummary(
      buildAccount({
        owner_scope: "shared",
        include_in_budget: false,
        include_in_cashflow: false,
        include_in_net_worth: true,
      }),
    );
    expect(owner).toBe("Samen");
    expect(summary).toBe("Gedeelde overzichtsrekening");
  });

  it("toont nette fallback bij ontbrekend rekeningnummer", () => {
    expect(formatAccountMaskedNumber(null)).toBe("Rekeningnummer niet bekend");
    expect(formatAccountMaskedNumber("")).toBe("Rekeningnummer niet bekend");
  });

  it("herkent inactieve rekening als niet actief in budget", () => {
    const summary = formatAccountOverviewSummary(
      buildAccount({
        is_active: false,
      }),
    );
    expect(summary).toBe("Niet actief in budget");
  });
});
