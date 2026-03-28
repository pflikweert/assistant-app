import { describe, expect, it } from "vitest";

import {
  mapSimpleSettingsToLegacyMeaning,
  resolveDefaultExcludeFromNetWorthForKind,
  resolveDefaultSimpleUsageForKind,
  resolveSimpleAccountSettingsFromLegacy,
} from "./bank-account-simple-settings";

describe("bank-account-simple-settings", () => {
  it("maps legacy shared operational account to simple shared checking", () => {
    const result = resolveSimpleAccountSettingsFromLegacy({
      account_type: "checking",
      owner_scope: "shared",
      forecast_role: "shared",
      include_in_budget: true,
      include_in_cashflow: true,
      include_in_net_worth: true,
    });
    expect(result).toEqual({
      usage: "shared",
      kind: "checking",
      excludeFromNetWorth: false,
    });
  });

  it("maps excluded account to simple exclude and keeps net-worth toggle", () => {
    const result = resolveSimpleAccountSettingsFromLegacy({
      account_type: "checking",
      owner_scope: "personal",
      forecast_role: "excluded",
      include_in_budget: false,
      include_in_cashflow: false,
      include_in_net_worth: false,
      name: "Zakelijke rekening",
      provider: "Rabobank zakelijk",
    });
    expect(result).toEqual({
      usage: "exclude",
      kind: "business",
      excludeFromNetWorth: true,
    });
  });

  it("maps simple personal checking to operational personal legacy fields", () => {
    const result = mapSimpleSettingsToLegacyMeaning({
      settings: {
        usage: "personal",
        kind: "checking",
        excludeFromNetWorth: false,
      },
    });
    expect(result).toMatchObject({
      accountType: "checking",
      ownerScope: "personal",
      forecastRole: "operational",
      includeInBudget: true,
      includeInCashflow: true,
      includeInNetWorth: true,
    });
  });

  it("maps simple shared savings to reserve behavior", () => {
    const result = mapSimpleSettingsToLegacyMeaning({
      settings: {
        usage: "shared",
        kind: "savings",
        excludeFromNetWorth: false,
      },
    });
    expect(result).toMatchObject({
      accountType: "savings",
      ownerScope: "shared",
      forecastRole: "reserve",
      includeInBudget: false,
      includeInCashflow: false,
      includeInNetWorth: true,
    });
  });

  it("maps simple exclude to excluded role and forces personal owner-scope", () => {
    const result = mapSimpleSettingsToLegacyMeaning({
      settings: {
        usage: "exclude",
        kind: "business",
        excludeFromNetWorth: true,
      },
      currentOwnerScope: "shared",
    });
    expect(result).toMatchObject({
      accountType: "checking",
      ownerScope: "personal",
      forecastRole: "excluded",
      includeInBudget: false,
      includeInCashflow: false,
      includeInNetWorth: false,
    });
  });

  it("uses excluded defaults for business/investment kinds", () => {
    expect(resolveDefaultSimpleUsageForKind("business")).toBe("exclude");
    expect(resolveDefaultSimpleUsageForKind("investment")).toBe("exclude");
    expect(resolveDefaultExcludeFromNetWorthForKind("business")).toBe(true);
    expect(resolveDefaultExcludeFromNetWorthForKind("investment")).toBe(true);
  });
});
