import { describe, expect, it } from "vitest";

import { findMatchingImportedTransaction } from "./transaction-import-match";

describe("findMatchingImportedTransaction", () => {
  it("prefers stable metadata references over details", () => {
    const existingRows = [
      {
        id: "existing-1",
        details: "Oude details",
        counterparty: "Andere tegenpartij",
        metadata: {
          "Transactiereferentie": "REF-123",
        },
      },
      {
        id: "existing-2",
        details: "Kleedgeld",
        counterparty: "L.V. Flikweert",
        metadata: {},
      },
    ];

    const match = findMatchingImportedTransaction(existingRows, {
      details: "Nieuwe details",
      counterparty: "Onbekend",
      metadata: {
        "Transactiereferentie": "REF-123",
      },
    });

    expect(match?.id).toBe("existing-1");
  });

  it("falls back to details and counterparty matching", () => {
    const existingRows = [
      {
        id: "existing-1",
        details: "Kleedgeld",
        counterparty: "L.V. Flikweert",
        metadata: {},
      },
      {
        id: "existing-2",
        details: "Kleedgeld",
        counterparty: "Iemand anders",
        metadata: {},
      },
    ];

    const match = findMatchingImportedTransaction(existingRows, {
      details: "Kleedgeld",
      counterparty: "L.V. Flikweert",
      metadata: {},
    });

    expect(match?.id).toBe("existing-1");
  });
});
