import { describe, expect, it } from "vitest";

import {
  getTransactionCleanupSuccessMessage,
  resolveTransactionCleanupScopeInfo,
} from "./transaction-data-cleanup";

describe("resolveTransactionCleanupScopeInfo", () => {
  it("builds the current month scope from the active calendar month", () => {
    const referenceDate = new Date(2026, 2, 24, 12, 0, 0);
    const info = resolveTransactionCleanupScopeInfo(
      "current_month",
      referenceDate,
    );

    expect(info.scope).toBe("current_month");
    expect(info.label).toBe("Huidige maand");
    expect(info.monthLabel).toBe("maart 2026");
    expect(info.startIso).toBe("2026-03-01");
    expect(info.endIso).toBe("2026-04-01");
    expect(info.confirmationTitle).toBe("maart 2026 wissen");
    expect(info.confirmationBody).toContain("maart 2026");
  });

  it("builds the all-data scope without a month window", () => {
    const info = resolveTransactionCleanupScopeInfo("all");

    expect(info.scope).toBe("all");
    expect(info.label).toBe("Alles");
    expect(info.startIso).toBeNull();
    expect(info.endIso).toBeNull();
    expect(info.confirmationTitle).toBe("Alle data verwijderen");
  });
});

describe("getTransactionCleanupSuccessMessage", () => {
  it("uses the current month label in the success message", () => {
    const referenceDate = new Date(2026, 2, 24, 12, 0, 0);
    const message = getTransactionCleanupSuccessMessage(
      "current_month",
      84,
      referenceDate,
    );

    expect(message).toBe(
      "84 transacties van maart 2026 gewist. Je kan nu opnieuw importeren.",
    );
  });

  it("falls back to an empty-state message when nothing matched", () => {
    const message = getTransactionCleanupSuccessMessage("all", 0);

    expect(message).toBe("Geen transacties gevonden om te wissen.");
  });
});
