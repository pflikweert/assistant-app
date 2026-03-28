import { describe, expect, it } from "vitest";

import { buildAnnualReserveSheetSummary } from "@/services/ui-formatters/labels";

describe("buildAnnualReserveSheetSummary", () => {
  it("houdt buffer en jaarlijkse lasten semantisch gescheiden wanneer rules leeg zijn", () => {
    const summary = buildAnnualReserveSheetSummary({
      reserveBreakdown: {
        reservedInAccountsNow: 7.16,
        reservedProtectedInOperationalNow: 100,
        annualObligationMonthlyTotal: 0,
        savingsTargetMonthly: 100,
      },
      currentReservedBalanceAmount: 107.16,
      annualRules: [],
    });

    expect(summary.totalReserved).toBe(107.16);
    expect(summary.bufferReserved).toBe(100);
    expect(summary.reservedInAccounts).toBe(7.16);
    expect(summary.annualActive).toBe(0);
    expect(summary.savingsTargetMonthly).toBe(100);
    expect(summary.reservedProtectedInOperational).toBe(100);
  });

  it("valt terug op actieve rules als breakdown geen annual total heeft", () => {
    const summary = buildAnnualReserveSheetSummary({
      reserveBreakdown: {
        reservedProtectedInOperationalNow: 120,
        annualObligationMonthlyTotal: null,
      },
      annualRules: [
        { status: "active", monthlyAmount: 40 },
        { status: "paused", monthlyAmount: 75 },
        { status: "active", monthlyAmount: 15.5 },
      ],
    });

    expect(summary.annualActive).toBe(55.5);
    expect(summary.bufferReserved).toBe(120);
  });
});
