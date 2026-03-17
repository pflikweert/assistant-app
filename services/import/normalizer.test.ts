import { describe, expect, it } from "vitest";

import {
  normalizeImportAmount,
  normalizeImportDate,
  normalizeImportRows,
} from "./normalizer";

describe("normalizeImportDate", () => {
  it("normalizes nl date format to iso", () => {
    expect(normalizeImportDate("31-12-2024")).toBe("2024-12-31");
  });

  it("accepts iso date", () => {
    expect(normalizeImportDate("2024-12-31")).toBe("2024-12-31");
  });

  it("rejects invalid date", () => {
    expect(normalizeImportDate("32-13-2024")).toBeNull();
  });
});

describe("normalizeImportAmount", () => {
  it("normalizes comma decimals", () => {
    expect(normalizeImportAmount("12,34")).toBe(12.34);
  });

  it("normalizes eu thousands", () => {
    expect(normalizeImportAmount("1.234,56")).toBe(1234.56);
  });

  it("rejects non numeric amount", () => {
    expect(normalizeImportAmount("abc")).toBeNull();
  });
});

describe("normalizeImportRows", () => {
  it("filters empty and invalid rows, returns canonical transactions", () => {
    const rows = normalizeImportRows([
      {
        Datum: "01-01-2025",
        Bedrag: "10,50",
        "Omschrijving-1": "Boodschappen",
        Volgnr: "0002",
      },
      {
        Datum: "",
        Bedrag: "",
      },
      {
        Date: "not-a-date",
        Amount: "99.9",
        "Naam / Omschrijving": "Invalid",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      date: "2025-01-01",
      amount: 10.5,
      details: "Boodschappen",
      seq: 2,
      counterparty: undefined,
      currency: undefined,
      type: undefined,
      metadata: undefined,
    });
  });
});
