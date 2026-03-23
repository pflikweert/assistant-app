import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseTransactionImport } from "./transaction-import-parser";

function readPdfFixtureAsBase64(filePath: string): string {
  const binary = fs.readFileSync(filePath);
  return binary.toString("base64");
}

describe("parseTransactionImport (pdf)", () => {
  it("parseert transacties uit PDF text-operators", () => {
    const pdfLikeContent =
      "%PDF-1.4\n" +
      "1 0 obj\n" +
      "<< /Length 140 >>\n" +
      "stream\n" +
      "BT\n" +
      "(01-03-2026 NL29RABO0363290044 Boodschappen Albert Heijn -12,34 EUR) Tj\n" +
      "(02-03-2026 Salaris Werkgever BV 2.500,00 EUR) Tj\n" +
      "ET\n" +
      "endstream\n" +
      "endobj\n";

    const base64 = Buffer.from(pdfLikeContent, "binary").toString("base64");
    const rows = parseTransactionImport("pdf", base64);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-03-01",
      amount: -12.34,
      currency: "EUR",
      type: "PDF",
    });
    expect(rows[1]).toMatchObject({
      date: "2026-03-02",
      amount: 2500,
      currency: "EUR",
      type: "PDF",
    });
  });

  const fixturePath = process.env.RABOBANK_PDF_FIXTURE
    ? path.resolve(process.cwd(), process.env.RABOBANK_PDF_FIXTURE)
    : path.resolve(process.cwd(), "tmp/import-fixtures/rabobank-transactions.pdf");
  const hasFixture = fs.existsSync(fixturePath);
  const maybeDescribe = hasFixture ? describe : describe.skip;

  maybeDescribe("met echte Rabobank PDF fixture", () => {
    it("herkent minimaal een set valide transacties", () => {
      const base64 = readPdfFixtureAsBase64(fixturePath);
      const rows = parseTransactionImport("pdf", base64);

      expect(rows.length).toBeGreaterThan(0);

      for (const row of rows) {
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isFinite(row.amount)).toBe(true);
        expect(row.details.length).toBeGreaterThan(0);
        expect(row.currency).toBe("EUR");
        expect(row.type).toBe("PDF");
      }
    });
  });
});
