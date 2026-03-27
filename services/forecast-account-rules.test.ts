import {
  applyForecastAccountRules,
  resolveForecastAccountRole,
  resolveForecastAccountRules,
  resolveForecastOwnerScope,
} from "@/services/forecast-account-rules";
import { describe, expect, it } from "vitest";

describe("forecast account rules", () => {
  it("geeft een checking rekening standaard operationeel gedrag", () => {
    const rules = resolveForecastAccountRules({
      account_type: "checking",
    });

    expect(rules.forecast_role).toBe("operational");
    expect(rules.include_in_cashflow).toBe(true);
    expect(rules.include_in_budget).toBe(true);
    expect(rules.include_in_net_worth).toBe(true);
    expect(rules.owner_scope).toBe("personal");
  });

  it("geeft spaarrekeningen reserve-gedrag met veilige inclusies", () => {
    const rules = resolveForecastAccountRules({
      account_type: "savings",
    });

    expect(resolveForecastAccountRole({ account_type: "savings" })).toBe(
      "reserve",
    );
    expect(rules.include_in_cashflow).toBe(false);
    expect(rules.include_in_budget).toBe(false);
    expect(rules.include_in_net_worth).toBe(true);
  });

  it("herkent gedeelde rekeningen via naam of provider", () => {
    const rules = resolveForecastAccountRules({
      account_type: "checking",
      name: "Gezamenlijke rekening",
      provider: "Rabobank",
    });

    expect(resolveForecastOwnerScope({ name: "Gezamenlijke rekening" })).toBe(
      "shared",
    );
    expect(rules.forecast_role).toBe("shared");
    expect(rules.include_in_cashflow).toBe(true);
    expect(rules.include_in_budget).toBe(true);
  });

  it("houdt onbekende accounttypes veilig operationeel", () => {
    const rules = resolveForecastAccountRules({
      account_type: "mystery",
    });

    expect(rules.forecast_role).toBe("operational");
    expect(rules.include_in_cashflow).toBe(true);
    expect(rules.include_in_budget).toBe(true);
    expect(rules.include_in_net_worth).toBe(true);
    expect(rules.owner_scope).toBe("personal");
  });

  it("zet credit en loan rekeningen buiten cashflow en budget", () => {
    const creditRules = resolveForecastAccountRules({
      account_type: "credit",
    });
    const loanRules = resolveForecastAccountRules({
      account_type: "loan",
    });

    expect(creditRules.forecast_role).toBe("excluded");
    expect(creditRules.include_in_cashflow).toBe(false);
    expect(creditRules.include_in_budget).toBe(false);
    expect(creditRules.include_in_net_worth).toBe(true);

    expect(loanRules.forecast_role).toBe("excluded");
    expect(loanRules.include_in_cashflow).toBe(false);
    expect(loanRules.include_in_budget).toBe(false);
    expect(loanRules.include_in_net_worth).toBe(true);
  });

  it("laat expliciete waarden van de aanroepende laag winnen", () => {
    const account = applyForecastAccountRules({
      id: "bank-1",
      name: "Mijn rekening",
      account_type: "checking",
      provider: null,
      currency: "EUR",
      account_masked: null,
      is_active: true,
      include_in_budget: false,
      forecast_role: "reserve",
      include_in_cashflow: false,
      include_in_net_worth: false,
      owner_scope: "child",
    });

    expect(account.forecast_role).toBe("reserve");
    expect(account.include_in_budget).toBe(false);
    expect(account.include_in_cashflow).toBe(false);
    expect(account.include_in_net_worth).toBe(false);
    expect(account.owner_scope).toBe("child");
  });
});
