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

import {
  parseRunningBalance,
  resolveLatestKnownBalanceSnapshot,
} from "@/services/latest-known-balance";

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
});
