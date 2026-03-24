import { afterAll, describe, expect, it, vi } from "vitest";

import { buildInsightsCategorySummary } from "./insights-category-summary";

vi.useFakeTimers();
vi.setSystemTime(new Date("2026-03-24T12:00:00.000Z"));

afterAll(() => {
  vi.useRealTimers();
});

function recommendation(input: {
  categoryKey: string;
  label: string;
  monthlyBudget: number;
  monthlyActual: number;
}) {
  return {
    categoryKey: input.categoryKey,
    label: input.label,
    monthlyBudget: input.monthlyBudget,
    monthlyActual: input.monthlyActual,
    appliedFactor: 1,
    weeklyBudget: Math.round(input.monthlyBudget / 4),
    monthProgress: 0.78,
    utilization:
      input.monthlyBudget > 0 ? input.monthlyActual / input.monthlyBudget : 0,
    overrideSource: "settings",
  };
}

function monthOption(key: string) {
  const [yearRaw, monthRaw] = key.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return {
    key,
    label: start.toLocaleDateString("nl-NL", {
      month: "long",
      year: "numeric",
    }),
    monthLabel: start.toLocaleDateString("nl-NL", {
      month: "long",
    }),
    startIso: `${key}-01`,
    endIso: `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}-01`,
    year,
    month,
    isCurrentMonth: key === "2026-03",
  };
}

describe("buildInsightsCategorySummary", () => {
  it("shows the expected ranking for an open month with budget data", () => {
    const model = buildInsightsCategorySummary({
      selectedMonth: monthOption("2026-03") as any,
      budgetPlan: {
        recommendations: [
          recommendation({
            categoryKey: "fixed_costs",
            label: "Vaste lasten",
            monthlyBudget: 900,
            monthlyActual: 500,
          }),
          recommendation({
            categoryKey: "subscriptions",
            label: "Abonnementen",
            monthlyBudget: 50,
            monthlyActual: 12,
          }),
          recommendation({
            categoryKey: "groceries",
            label: "Boodschappen",
            monthlyBudget: 350,
            monthlyActual: 180,
          }),
          recommendation({
            categoryKey: "fuel",
            label: "Brandstof",
            monthlyBudget: 120,
            monthlyActual: 30,
          }),
          recommendation({
            categoryKey: "smoking",
            label: "Roken",
            monthlyBudget: 80,
            monthlyActual: 0,
          }),
          recommendation({
            categoryKey: "other",
            label: "Overig",
            monthlyBudget: 60,
            monthlyActual: 0,
          }),
          recommendation({
            categoryKey: "savings_target",
            label: "Spaardoel",
            monthlyBudget: 200,
            monthlyActual: 0,
          }),
        ],
      } as any,
      currentMonthTransactions: [],
    });

    expect(model.title).toBe("Verwachte grootste uitgaven");
    expect(model.subtitle).toContain("geplande lasten");
    expect(model.rows).toHaveLength(5);
    expect(model.rows.map((row) => row.label)).toEqual([
      "Vaste lasten",
      "Boodschappen",
      "Brandstof",
      "Roken",
      "Overig",
    ]);
    expect(model.rows[0].statusLabel).toBe("Verwacht");
    expect(model.rows[0].contextLabel).toContain("uitgegeven tot nu toe");
    expect(model.rows[3].statusLabel).toBe("Gepland");
  });

  it("shows actual spending for a closed month without expectation language", () => {
    const model = buildInsightsCategorySummary({
      selectedMonth: monthOption("2026-02") as any,
      budgetPlan: {
        recommendations: [
          recommendation({
            categoryKey: "fixed_costs",
            label: "Vaste lasten",
            monthlyBudget: 900,
            monthlyActual: 860,
          }),
          recommendation({
            categoryKey: "subscriptions",
            label: "Abonnementen",
            monthlyBudget: 50,
            monthlyActual: 44,
          }),
          recommendation({
            categoryKey: "groceries",
            label: "Boodschappen",
            monthlyBudget: 350,
            monthlyActual: 310,
          }),
          recommendation({
            categoryKey: "fuel",
            label: "Brandstof",
            monthlyBudget: 120,
            monthlyActual: 55,
          }),
        ],
      } as any,
      currentMonthTransactions: [],
    });

    expect(model.title).toBe("Grootste uitgaven deze maand");
    expect(model.subtitle).toBe("Gebaseerd op werkelijke uitgaven");
    expect(model.rows).toHaveLength(4);
    expect(model.rows.every((row) => row.statusLabel === "Werkelijk")).toBe(true);
    expect(model.rows.every((row) => row.contextLabel.includes("Werkelijke uitgaven"))).toBe(
      true,
    );
  });

  it("falls back to actuals when budget data is missing", () => {
    const model = buildInsightsCategorySummary({
      selectedMonth: monthOption("2026-03") as any,
      budgetPlan: null,
      currentMonthTransactions: [
        {
          amount: -180,
          counterparty: "Jumbo",
          date: "2026-03-03",
          details: "Jumbo",
          categoryKey: "groceries",
          categoryLabel: "Boodschappen",
          analysisCategory: "variable_costs",
        },
        {
          amount: -850,
          counterparty: "Woningstichting",
          date: "2026-03-04",
          details: "Huur",
          categoryKey: "fixed_costs",
          categoryLabel: "Vaste lasten",
          analysisCategory: "fixed_costs",
        },
      ] as any,
    });

    expect(model.title).toBe("Grootste uitgaven tot nu toe");
    expect(model.subtitle).toContain("beperkte budgetdata");
    expect(model.rows).toHaveLength(2);
    expect(model.rows[0].statusLabel).toBe("Werkelijk");
    expect(model.rows[0].contextLabel).toContain("Werkelijke uitgaven");
  });

  it("treats future months as open months", () => {
    const model = buildInsightsCategorySummary({
      selectedMonth: monthOption("2026-04") as any,
      budgetPlan: {
        recommendations: [
          recommendation({
            categoryKey: "fixed_costs",
            label: "Vaste lasten",
            monthlyBudget: 900,
            monthlyActual: 0,
          }),
          recommendation({
            categoryKey: "subscriptions",
            label: "Abonnementen",
            monthlyBudget: 50,
            monthlyActual: 0,
          }),
        ],
      } as any,
      currentMonthTransactions: [],
    });

    expect(model.title).toBe("Verwachte grootste uitgaven");
    expect(model.rows[0].statusLabel).toBe("Gepland");
    expect(model.rows[0].contextLabel).toBe("Nog niet afgeschreven");
  });

  it("returns all main categories when no row limit is provided", () => {
    const model = buildInsightsCategorySummary({
      selectedMonth: monthOption("2026-03") as any,
      budgetPlan: {
        recommendations: [
          recommendation({
            categoryKey: "fixed_costs",
            label: "Vaste lasten",
            monthlyBudget: 900,
            monthlyActual: 500,
          }),
          recommendation({
            categoryKey: "subscriptions",
            label: "Abonnementen",
            monthlyBudget: 50,
            monthlyActual: 12,
          }),
          recommendation({
            categoryKey: "groceries",
            label: "Boodschappen",
            monthlyBudget: 350,
            monthlyActual: 180,
          }),
          recommendation({
            categoryKey: "fuel",
            label: "Brandstof",
            monthlyBudget: 120,
            monthlyActual: 30,
          }),
          recommendation({
            categoryKey: "smoking",
            label: "Roken",
            monthlyBudget: 80,
            monthlyActual: 10,
          }),
          recommendation({
            categoryKey: "other",
            label: "Overig",
            monthlyBudget: 60,
            monthlyActual: 5,
          }),
        ],
      } as any,
      currentMonthTransactions: [],
      maxRows: null,
    });

    expect(model.rows).toHaveLength(6);
  });
});
