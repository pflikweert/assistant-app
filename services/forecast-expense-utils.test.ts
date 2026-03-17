import { describe, expect, it } from "vitest";

import { estimateRecentExpenseForecastFromHistory } from "./forecast-expense-utils";

describe("estimateRecentExpenseForecastFromHistory", () => {
  it("uses recent completed months with extra weight on the latest month", () => {
    const categoryMap = new Map([
      ["cat-groceries", { id: "cat-groceries", key: "groceries" }],
      ["cat-fuel", { id: "cat-fuel", key: "fuel" }],
    ]);

    const forecast = estimateRecentExpenseForecastFromHistory({
      currentMonthStart: new Date("2026-03-01T00:00:00.000Z"),
      categoryMap,
      transactions: [
        {
          date: "2026-01-06",
          amount: -100,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-02-08",
          amount: -200,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-01-11",
          amount: -20,
          details: "Shell",
          counterparty: "Shell",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-fuel",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-02-11",
          amount: -40,
          details: "Shell",
          counterparty: "Shell",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-fuel",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-01-03",
          amount: -800,
          details: "Huur",
          counterparty: "Woningstichting",
          analysis_main_group: "expense",
          analysis_category: "fixed_costs",
          category_id_auto: null,
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-02-03",
          amount: -750,
          details: "Huur",
          counterparty: "Woningstichting",
          analysis_main_group: "expense",
          analysis_category: "fixed_costs",
          category_id_auto: null,
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-01-16",
          amount: -50,
          details: "Spotify",
          counterparty: "Spotify",
          analysis_main_group: "expense",
          analysis_category: "subscriptions",
          category_id_auto: null,
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-02-16",
          amount: -60,
          details: "Spotify",
          counterparty: "Spotify",
          analysis_main_group: "expense",
          analysis_category: "subscriptions",
          category_id_auto: null,
          category_id_user: null,
          budget_excluded: false,
        },
      ],
    });

    expect(forecast.fixedCosts).toBe(764);
    expect(forecast.subscriptions).toBe(57.2);
    expect(forecast.variable.groceries).toBe(172);
    expect(forecast.variable.fuel).toBe(34.4);
    expect(forecast.variableCosts).toBe(206.4);
  });

  it("never drops below current month actual spend and ignores excluded transactions", () => {
    const categoryMap = new Map([
      ["cat-groceries", { id: "cat-groceries", key: "groceries" }],
    ]);

    const forecast = estimateRecentExpenseForecastFromHistory({
      currentMonthStart: new Date("2026-03-01T00:00:00.000Z"),
      categoryMap,
      transactions: [
        {
          date: "2026-02-05",
          amount: -90,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-03-05",
          amount: -140,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-03-07",
          amount: -500,
          details: "Buiten budget test",
          counterparty: "Test",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: true,
        },
      ],
    });

    expect(forecast.variable.groceries).toBe(140);
    expect(forecast.variableCosts).toBe(140);
  });

  it("falls back to current month actuals when there are no completed months yet", () => {
    const categoryMap = new Map([
      ["cat-groceries", { id: "cat-groceries", key: "groceries" }],
    ]);

    const forecast = estimateRecentExpenseForecastFromHistory({
      currentMonthStart: new Date("2026-03-01T00:00:00.000Z"),
      categoryMap,
      transactions: [
        {
          date: "2026-03-05",
          amount: -75,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
      ],
    });

    expect(forecast.variable.groceries).toBe(75);
    expect(forecast.variableCosts).toBe(75);
  });

  it("tracks recurring savings transfers separately from expense totals", () => {
    const forecast = estimateRecentExpenseForecastFromHistory({
      currentMonthStart: new Date("2026-03-01T00:00:00.000Z"),
      categoryMap: new Map(),
      transactions: [
        {
          date: "2026-01-25",
          amount: -150,
          details: "Naar sparen",
          counterparty: "Eigen rekening",
          analysis_main_group: "expense",
          analysis_category: "savings_transfer",
          category_id_auto: null,
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-02-25",
          amount: -175,
          details: "Naar sparen",
          counterparty: "Eigen rekening",
          analysis_main_group: "expense",
          analysis_category: "savings_transfer",
          category_id_auto: null,
          category_id_user: null,
          budget_excluded: false,
        },
      ],
    });

    expect(forecast.savingsTransfers).toBe(168);
    expect(forecast.fixedCosts).toBe(0);
    expect(forecast.subscriptions).toBe(0);
    expect(forecast.variableCosts).toBe(0);
  });

  it("ignores older outlier months outside the recent history window", () => {
    const categoryMap = new Map([
      ["cat-groceries", { id: "cat-groceries", key: "groceries" }],
    ]);

    const forecast = estimateRecentExpenseForecastFromHistory({
      currentMonthStart: new Date("2026-03-01T00:00:00.000Z"),
      categoryMap,
      transactions: [
        {
          date: "2025-12-05",
          amount: -1000,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-01-05",
          amount: -100,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
        {
          date: "2026-02-05",
          amount: -100,
          details: "Albert Heijn",
          counterparty: "Albert Heijn",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          category_id_auto: "cat-groceries",
          category_id_user: null,
          budget_excluded: false,
        },
      ],
    });

    expect(forecast.variable.groceries).toBe(100);
    expect(forecast.variableCosts).toBe(100);
  });
});
