import { describe, expect, it } from "vitest";

import {
  deriveIncomeSourcesFromTransactions,
  mergeForecastIncomeSources,
} from "./forecast-derived-income-sources";

const categoryMap = new Map([
  [
    "salary",
    {
      id: "salary",
      key: "income_salary",
      name: "Salaris",
      parent_id: null,
      budget_group: null,
      sort_order: 1,
    },
  ],
  [
    "kgb",
    {
      id: "kgb",
      key: "income_child_budget",
      name: "Kindgebonden budget",
      parent_id: null,
      budget_group: null,
      sort_order: 2,
    },
  ],
]);

describe("deriveIncomeSourcesFromTransactions", () => {
  it("derives recurring salary and child budget sources from transaction history", () => {
    const sources = deriveIncomeSourcesFromTransactions(
      [
        {
          date: "2026-03-15",
          amount: 2508.65,
          details: "Marktplaats verkoop",
          counterparty: "Marktplaats",
          recurring_type: null,
          category_id_auto: null,
          category_id_user: null,
          analysis_category: "income_variable",
        },
        {
          date: "2026-02-25",
          amount: 2400,
          details: "Salaris februari",
          counterparty: "Werkgever BV",
          recurring_type: "monthly",
          category_id_auto: "salary",
          category_id_user: null,
          analysis_category: "income_structural",
        },
        {
          date: "2026-01-25",
          amount: 2400,
          details: "Salaris januari",
          counterparty: "Werkgever BV",
          recurring_type: "monthly",
          category_id_auto: "salary",
          category_id_user: null,
          analysis_category: "income_structural",
        },
        {
          date: "2026-02-20",
          amount: 405,
          details: "Voorschot KIT/KGB",
          counterparty: "Belastingdienst",
          recurring_type: "monthly",
          category_id_auto: "kgb",
          category_id_user: null,
          analysis_category: "income_structural",
        },
      ],
      categoryMap as any,
    );

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_key: "werkgever bv",
          expected_income: 2400,
          income_frequency: "monthly",
        }),
        expect.objectContaining({
          source_key: "belastingdienst",
          expected_income: 405,
          income_frequency: "monthly",
        }),
        expect.objectContaining({
          source_key: "marktplaats",
          expected_income: 2508.65,
          income_frequency: "irregular",
        }),
      ]),
    );
  });
});

describe("mergeForecastIncomeSources", () => {
  it("keeps derived salary sources when the persisted table is incomplete", () => {
    const merged = mergeForecastIncomeSources(
      [
        {
          source_key: "belastingdienst",
          source_label: "Belastingdienst",
          expected_income: 405,
          income_frequency: "monthly",
          income_day_of_month: 20,
          last_detected_at: "2026-02-20T12:00:00.000Z",
        },
      ],
      [
        {
          source_key: "werkgever bv",
          source_label: "Werkgever BV",
          expected_income: 2400,
          income_frequency: "monthly",
          income_day_of_month: 25,
          last_detected_at: "2026-02-25T12:00:00.000Z",
        },
      ],
    );

    expect(merged).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_key: "werkgever bv",
          expected_income: 2400,
        }),
        expect.objectContaining({
          source_key: "belastingdienst",
          expected_income: 405,
        }),
      ]),
    );
  });
});
