/* eslint-disable import/first */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: vi.fn(),
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock("@/services/bank-accounts", () => ({
  listBankAccountsForUser: vi.fn(),
}));

import {
  parseRunningBalance,
  resolveLatestKnownBalanceSnapshot,
} from "@/services/latest-known-balance";
import type { BankAccount } from "@/services/bank-accounts";
import type { MoneyViewScope } from "@/services/finance-scope";

describe("latest-known-balance", () => {
  it("parses running balance from transaction metadata", () => {
    expect(
      parseRunningBalance({
        "Saldo na trn": "531,82",
      }),
    ).toBe(531.82);
  });

  it("selects the newest known balance using date and sequence", () => {
    const snapshot = resolveLatestKnownBalanceSnapshot([
      {
        date: "2026-03-24",
        metadata: {
          "Saldo na trn": "428,41",
          Volgnr: "0010",
        },
      },
      {
        date: "2026-03-25",
        metadata: {
          "Saldo na trn": "531,82",
          Volgnr: "0002",
        },
      },
      {
        date: "2026-03-25",
        metadata: {
          "Saldo na trn": "520,10",
          Volgnr: "0001",
        },
      },
    ]);

    expect(snapshot).toEqual({
      balance: 531.82,
      date: "2026-03-25",
    });
  });

  it("sums the latest balance per account within the chosen money view scope", () => {
    const bankAccountsById = new Map<string, BankAccount>([
      [
        "personal-1",
        {
          id: "personal-1",
          name: "Persoonlijk",
          account_type: "checking",
          provider: null,
          currency: "EUR",
          account_masked: null,
          is_active: true,
          include_in_budget: true,
          forecast_role: "operational",
          include_in_cashflow: true,
          include_in_net_worth: true,
          owner_scope: "personal",
        },
      ],
      [
        "shared-1",
        {
          id: "shared-1",
          name: "Samen",
          account_type: "checking",
          provider: null,
          currency: "EUR",
          account_masked: null,
          is_active: true,
          include_in_budget: true,
          forecast_role: "shared",
          include_in_cashflow: true,
          include_in_net_worth: true,
          owner_scope: "shared",
        },
      ],
    ]);

    const scope: MoneyViewScope = "shared";
    const snapshot = resolveLatestKnownBalanceSnapshot(
      [
        {
          bank_account_id: "personal-1",
          date: "2026-03-24",
          metadata: {
            "Saldo na trn": "500,00",
            Volgnr: "0010",
          },
        },
        {
          bank_account_id: "shared-1",
          date: "2026-03-24",
          metadata: {
            "Saldo na trn": "250,00",
            Volgnr: "0010",
          },
        },
      ],
      {
        bankAccountsById,
        moneyViewScope: scope,
      },
    );

    expect(snapshot).toEqual({
      balance: 750,
      date: "2026-03-24",
    });
  });

  it("neemt net-worth accounts mee die buiten cashflow vallen wanneer dimension net_worth is", () => {
    const bankAccountsById = new Map<string, BankAccount>([
      [
        "operational-1",
        {
          id: "operational-1",
          name: "Betaal",
          account_type: "checking",
          provider: null,
          currency: "EUR",
          account_masked: null,
          is_active: true,
          include_in_budget: true,
          forecast_role: "operational",
          include_in_cashflow: true,
          include_in_net_worth: true,
          owner_scope: "personal",
        },
      ],
      [
        "reserve-1",
        {
          id: "reserve-1",
          name: "Spaar",
          account_type: "savings",
          provider: null,
          currency: "EUR",
          account_masked: null,
          is_active: true,
          include_in_budget: false,
          forecast_role: "reserve",
          include_in_cashflow: false,
          include_in_net_worth: true,
          owner_scope: "personal",
        },
      ],
    ]);

    const rows = [
      {
        bank_account_id: "operational-1",
        date: "2026-03-24",
        metadata: { "Saldo na trn": "1000,00", Volgnr: "0010" },
      },
      {
        bank_account_id: "reserve-1",
        date: "2026-03-24",
        metadata: { "Saldo na trn": "120,00", Volgnr: "0010" },
      },
    ];

    const operationalSnapshot = resolveLatestKnownBalanceSnapshot(rows, {
      bankAccountsById,
      moneyViewScope: "personal",
      dimension: "operational",
    });
    const netWorthSnapshot = resolveLatestKnownBalanceSnapshot(rows, {
      bankAccountsById,
      moneyViewScope: "personal",
      dimension: "net_worth",
    });

    expect(operationalSnapshot.balance).toBe(1000);
    expect(netWorthSnapshot.balance).toBe(1120);
  });
});
