/* eslint-disable import/first */
import { describe, expect, it, vi } from "vitest";

vi.mock("./bank-accounts", () => ({
  hashAccountNumber: async (value: string) =>
    `hash:${String(value || "")
      .replace(/\s+/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()}`,
  normalizeAccountNumber: (value?: string | null) => {
    const normalized = String(value || "")
      .replace(/\s+/g, "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase();
    return normalized || null;
  },
}));

import {
  extractCounterpartyAccountCandidatesFromMetadata,
  hasOwnAccountTransferHint,
  resolveOwnAccountTransferHeuristicMatch,
  resolveOwnAccountTransferCategory,
} from "./own-account-transfer-heuristics";

describe("own-account-transfer-heuristics", () => {
  it("detects own-account transfer hints in details", () => {
    expect(
      hasOwnAccountTransferHint({
        counterparty: "Rabobank",
        details: "Betaalverzoeken / onderlinge betalingen | tb = eigen rekening",
      }),
    ).toBe(true);
  });

  it("does not classify generic peer-to-peer payments as own-account transfer", () => {
    expect(
      hasOwnAccountTransferHint({
        counterparty: "Tikkie",
        details: "Betaalverzoek etentje",
      }),
    ).toBe(false);
  });

  it("prefers dedicated internal-transfer category and falls back to savings_transfer", () => {
    const withDedicated = new Map([
      [
        "savings_investing_internal_transfer",
        {
          id: "cat-own",
          key: "savings_investing_internal_transfer",
          name: "Overboeking eigen rekening",
          parent_id: null,
          budget_group: "savings",
          sort_order: 114,
        },
      ],
      [
        "savings_transfer",
        {
          id: "cat-fallback",
          key: "savings_transfer",
          name: "Overboeking naar sparen",
          parent_id: null,
          budget_group: "savings",
          sort_order: 115,
        },
      ],
    ]);
    expect(resolveOwnAccountTransferCategory(withDedicated as any)?.id).toBe("cat-own");

    const fallbackOnly = new Map([
      [
        "savings_transfer",
        {
          id: "cat-fallback",
          key: "savings_transfer",
          name: "Overboeking naar sparen",
          parent_id: null,
          budget_group: "savings",
          sort_order: 115,
        },
      ],
    ]);
    expect(resolveOwnAccountTransferCategory(fallbackOnly as any)?.id).toBe("cat-fallback");
  });

  it("extracts counterparty account numbers from metadata keys", () => {
    const candidates = extractCounterpartyAccountCandidatesFromMetadata({
      "Tegenrekening IBAN/BBAN": "NL32RABO0386559805",
      "IBAN/BBAN": "NL63RABO3465632672",
      "Naam tegenpartij": "P. Flikweert",
      "BIC tegenpartij": "",
    });

    expect(candidates).toEqual(["NL32RABO0386559805"]);
  });

  it("resolves to internal transfer when metadata counterparty account matches own accounts", async () => {
    const categoriesByKey = new Map([
      [
        "savings_investing_internal_transfer",
        {
          id: "cat-own",
          key: "savings_investing_internal_transfer",
          name: "Overboeking eigen rekening",
          parent_id: null,
          budget_group: "savings",
          sort_order: 114,
        },
      ],
    ]);

    const match = await resolveOwnAccountTransferHeuristicMatch({
      details: "Afschrijving | P. Flikweert",
      counterparty: "P. Flikweert",
      metadata: {
        "Tegenrekening IBAN/BBAN": "NL32RABO0386559805",
      },
      categoriesByKey: categoriesByKey as any,
      ownAccountHashes: new Set(["hash:NL32RABO0386559805"]),
    });

    expect(match).toMatchObject({
      categoryId: "cat-own",
      model: "heuristic-own-account-transfer-metadata-v1",
    });
  });
});
