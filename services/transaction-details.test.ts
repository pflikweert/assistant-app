import { describe, expect, it } from "vitest";

import { normalizeTransactionDetails } from "./transaction-details";

describe("normalizeTransactionDetails", () => {
  it("removes empty pipe segments", () => {
    expect(normalizeTransactionDetails("A |   | B")).toBe("A | B");
  });

  it("trims leading and trailing pipe segments", () => {
    expect(normalizeTransactionDetails("  |   | P. Flikweert")).toBe(
      "P. Flikweert",
    );
  });

  it("keeps inner spacing inside segments intact", () => {
    expect(
      normalizeTransactionDetails(
        "Kosten                             Rabo TotaalPakket                  Periode 01-10-2025 t/m 31-10-2025 |   | Rabobank",
      ),
    ).toBe(
      "Kosten                             Rabo TotaalPakket                  Periode 01-10-2025 t/m 31-10-2025 | Rabobank",
    );
  });
});
