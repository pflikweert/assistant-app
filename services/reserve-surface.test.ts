import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listBankAccountsForUserMock,
  listAnnualObligationReserveRulesMock,
  supabaseFromMock,
  txRowsRef,
} = vi.hoisted(() => {
  const txRowsRef = {
    rows: [] as Record<string, unknown>[],
    error: null as unknown,
  };

  const supabaseFromMock = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({
              data: txRowsRef.rows,
              error: txRowsRef.error,
            })),
          })),
        })),
      })),
    })),
  }));

  return {
    listBankAccountsForUserMock: vi.fn(),
    listAnnualObligationReserveRulesMock: vi.fn(),
    supabaseFromMock,
    txRowsRef,
  };
});

vi.mock("@/services/bank-accounts", () => ({
  listBankAccountsForUser: listBankAccountsForUserMock,
}));

vi.mock("@/services/reserve-rules", () => ({
  listAnnualObligationReserveRules: listAnnualObligationReserveRulesMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

let loadReserveSurfaceBreakdown: typeof import("./reserve-surface").loadReserveSurfaceBreakdown;

describe("reserve-surface", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ loadReserveSurfaceBreakdown } = await import("./reserve-surface"));
    listBankAccountsForUserMock.mockReset();
    listAnnualObligationReserveRulesMock.mockReset();
    supabaseFromMock.mockClear();
    txRowsRef.rows = [];
    txRowsRef.error = null;
  });

  it("scheidt reserved-in-accounts en protected-in-operational semantisch", async () => {
    listBankAccountsForUserMock.mockResolvedValue([
      {
        id: "acc-reserve",
        include_in_net_worth: true,
        forecast_role: "reserve",
        owner_scope: "personal",
      },
      {
        id: "acc-checking",
        include_in_net_worth: true,
        forecast_role: "operational",
        owner_scope: "personal",
      },
    ]);
    listAnnualObligationReserveRulesMock.mockResolvedValue([
      {
        id: "rule-1",
        monthlyAmount: 80,
        status: "active",
      },
      {
        id: "rule-2",
        monthlyAmount: 40,
        status: "paused",
      },
    ]);
    txRowsRef.rows = [
      {
        bank_account_id: "acc-reserve",
        date: "2026-03-26",
        metadata: { "Saldo na trn": "500,00", Volgnr: "001" },
      },
      {
        bank_account_id: "acc-checking",
        date: "2026-03-26",
        metadata: { "Saldo na trn": "1200,00", Volgnr: "002" },
      },
    ];

    const result = await loadReserveSurfaceBreakdown({
      userId: "user-1",
      moneyViewScope: "personal",
      budgetPlan: {
        settings: {
          savingsTargetMonthly: 60,
        },
      } as any,
    });

    expect(result).toEqual({
      reservedInAccountsNow: 500,
      reservedProtectedInOperationalNow: 140,
      plannedReserveAllocationThisMonth: 140,
      annualObligationMonthlyTotal: 80,
      savingsTargetMonthly: 60,
      source: "modeled",
    });
  });

  it("blijft unavailable als er geen betrouwbare reserve-semantiek is", async () => {
    listBankAccountsForUserMock.mockResolvedValue([]);
    listAnnualObligationReserveRulesMock.mockResolvedValue([]);
    txRowsRef.rows = [];

    const result = await loadReserveSurfaceBreakdown({
      userId: "user-1",
      moneyViewScope: "personal",
      budgetPlan: null,
    });

    expect(result).toEqual({
      reservedInAccountsNow: null,
      reservedProtectedInOperationalNow: null,
      plannedReserveAllocationThisMonth: null,
      annualObligationMonthlyTotal: null,
      savingsTargetMonthly: null,
      source: "unavailable",
    });
  });

  it("blijft scope-aware: personal telt geen shared reserve-account mee", async () => {
    listBankAccountsForUserMock.mockResolvedValue([
      {
        id: "acc-shared-reserve",
        include_in_net_worth: true,
        forecast_role: "reserve",
        owner_scope: "shared",
      },
    ]);
    listAnnualObligationReserveRulesMock.mockResolvedValue([]);
    txRowsRef.rows = [
      {
        bank_account_id: "acc-shared-reserve",
        date: "2026-03-26",
        metadata: { "Saldo na trn": "800,00", Volgnr: "001" },
      },
    ];

    const personal = await loadReserveSurfaceBreakdown({
      userId: "user-1",
      moneyViewScope: "personal",
      budgetPlan: null,
    });
    const shared = await loadReserveSurfaceBreakdown({
      userId: "user-1",
      moneyViewScope: "shared",
      budgetPlan: null,
    });

    expect(personal.reservedInAccountsNow).toBeNull();
    expect(shared.reservedInAccountsNow).toBe(800);
  });
});
