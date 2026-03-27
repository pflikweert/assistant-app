import { describe, expect, it } from "vitest";

import { normalizeForecastEventsForMonth } from "./forecast-event-normalization";

type TestBankAccount = {
  id: string;
  account_type: string;
  name: string;
  provider: string | null;
  currency: string;
  account_masked: string | null;
  is_active: boolean;
  include_in_budget: boolean;
  include_in_cashflow: boolean;
  include_in_net_worth: boolean;
  forecast_role: "operational" | "reserve" | "goal" | "shared" | "observation_only" | "excluded";
  owner_scope: "personal" | "shared" | "child" | "external";
};

describe("normalizeForecastEventsForMonth", () => {
  it("classificeert bekende transacties naar de genormaliseerde eventlaag", () => {
    const bankAccountsById = new Map<string, TestBankAccount>([
      [
        "checking-1",
        {
          id: "checking-1",
          name: "Privérekening",
          account_type: "checking",
          provider: "ING",
          currency: "EUR",
          account_masked: null,
          is_active: true,
          include_in_budget: true,
          include_in_cashflow: true,
          include_in_net_worth: true,
          forecast_role: "operational",
          owner_scope: "personal",
        },
      ],
      [
        "savings-1",
        {
          id: "savings-1",
          name: "Spaarrekening",
          account_type: "savings",
          provider: "Rabobank",
          currency: "EUR",
          account_masked: null,
          is_active: true,
          include_in_budget: true,
          include_in_cashflow: false,
          include_in_net_worth: true,
          forecast_role: "reserve",
          owner_scope: "personal",
        },
      ],
    ]);

    const events = normalizeForecastEventsForMonth({
      monthStart: new Date("2026-03-01T00:00:00.000Z"),
      monthEndExclusive: new Date("2026-04-01T00:00:00.000Z"),
      referenceDate: new Date("2026-03-10T00:00:00.000Z"),
      categoryMap: new Map(),
      bankAccountsById,
      bookedTransactions: [
        {
          id: "observed-1",
          date: "2026-03-05",
          amount: -20,
          details: "Pinbetaling",
          counterparty: "Winkel",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          recurring: false,
          recurring_type: null,
          category_id_auto: null,
          category_id_user: null,
          bank_account_id: "checking-1",
          budget_excluded: false,
          metadata: {},
        },
        {
          id: "salary-1",
          date: "2026-03-25",
          amount: 2400,
          details: "Salaris maart",
          counterparty: "Werkgever BV",
          analysis_main_group: "income",
          analysis_category: "income_structural",
          recurring: true,
          recurring_type: "monthly",
          category_id_auto: null,
          category_id_user: null,
          bank_account_id: "checking-1",
          budget_excluded: false,
          metadata: {},
        },
        {
          id: "rent-1",
          date: "2026-03-15",
          amount: -1200,
          details: "Huur",
          counterparty: "Woningstichting",
          analysis_main_group: "expense",
          analysis_category: "fixed_costs",
          recurring: true,
          recurring_type: "monthly",
          category_id_auto: null,
          category_id_user: null,
          bank_account_id: "checking-1",
          budget_excluded: false,
          metadata: {},
        },
        {
          id: "save-1",
          date: "2026-03-18",
          amount: -250,
          details: "Naar spaarrekening",
          counterparty: "Eigen rekening",
          analysis_main_group: "expense",
          analysis_category: "savings_transfer",
          recurring: false,
          recurring_type: null,
          category_id_auto: null,
          category_id_user: null,
          bank_account_id: "checking-1",
          budget_excluded: false,
          metadata: {},
        },
        {
          id: "transfer-1",
          date: "2026-03-19",
          amount: -80,
          details: "Overboeking eigen rekening",
          counterparty: "Eigen rekening",
          analysis_main_group: "expense",
          analysis_category: "variable_costs",
          recurring: false,
          recurring_type: null,
          category_id_auto: null,
          category_id_user: null,
          bank_account_id: "checking-1",
          budget_excluded: false,
          metadata: {},
        },
      ],
      timelineEvents: [],
    });

    expect(events.map((event) => event.type)).toEqual([
      "expense",
      "reserve_allocation",
      "internal_transfer",
      "income",
    ]);
    expect(events[0]?.certainty).toBe("booked");
    expect(events[1]?.moneyLayer).toBe("reserved");
    expect(events[2]?.certainty).toBe("booked");
  });
});
