import { describe, expect, it } from "vitest";

import { isForecastEligibleIncomeTransaction } from "./forecast-income-utils";

const categoryMap = new Map([
  ["salary", { key: "income_salary", budget_group: null }],
  ["kgb", { key: "income_child_budget", budget_group: null }],
  ["tax-refund", { key: "income_tax_refund", budget_group: null }],
  ["zvw", { key: "care_health_insurance", budget_group: "fixed" }],
]);

describe("isForecastEligibleIncomeTransaction", () => {
  it("keeps structural income eligible for forecast baselines", () => {
    expect(
      isForecastEligibleIncomeTransaction(
        {
          amount: 2450,
          counterparty: "Werkgever BV",
          details: "Salaris maart",
          analysis_main_group: "income",
          analysis_category: "income_structural",
          category_id_auto: "salary",
          category_id_user: null,
        },
        categoryMap,
      ),
    ).toBe(true);

    expect(
      isForecastEligibleIncomeTransaction(
        {
          amount: 241,
          counterparty: "Belastingdienst",
          details: "Voorschot KIT/KGB",
          analysis_main_group: "income",
          analysis_category: "income_structural",
          category_id_auto: "kgb",
          category_id_user: null,
        },
        categoryMap,
      ),
    ).toBe(true);
  });

  it("excludes tax refunds from recurring forecast income", () => {
    expect(
      isForecastEligibleIncomeTransaction(
        {
          amount: 812,
          counterparty: "Belastingdienst",
          details: "Voorlopige aanslag teruggave inkomstenbelasting",
          analysis_main_group: "income",
          analysis_category: "income_variable",
          category_id_auto: "tax-refund",
          category_id_user: null,
        },
        categoryMap,
      ),
    ).toBe(false);
  });

  it("excludes cost compensations such as positive ZVW settlements", () => {
    expect(
      isForecastEligibleIncomeTransaction(
        {
          amount: 94,
          counterparty: "Belastingdienst",
          details: "Bijdrage ZVW afrekening",
          analysis_main_group: "income",
          analysis_category: "income_variable",
          category_id_auto: "zvw",
          category_id_user: null,
        },
        categoryMap,
      ),
    ).toBe(false);
  });

  it("rejects non-income or non-positive transactions early", () => {
    expect(
      isForecastEligibleIncomeTransaction(
        {
          amount: -20,
          counterparty: "Werkgever BV",
          details: "Correctie",
          analysis_main_group: "income",
          analysis_category: "income_variable",
          category_id_auto: "salary",
          category_id_user: null,
        },
        categoryMap,
      ),
    ).toBe(false);

    expect(
      isForecastEligibleIncomeTransaction(
        {
          amount: 20,
          counterparty: "Werkgever BV",
          details: "Correctie",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "salary",
          category_id_user: null,
        },
        categoryMap,
      ),
    ).toBe(false);
  });
});
