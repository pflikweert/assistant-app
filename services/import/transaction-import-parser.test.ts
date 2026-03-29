import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { describe, expect, it } from "vitest";

import { parseTransactionImport } from "./transaction-import-parser";

function createCompressedRabobankPdfContent(contentStream: string): string {
  const deflated = zlib.deflateSync(Buffer.from(contentStream, "utf8"));
  const pdf = Buffer.concat([
    Buffer.from("%PDF-1.7\n", "utf8"),
    Buffer.from(
      `1 0 obj\n<< /Length ${deflated.length} /Filter /FlateDecode >>\nstream\n`,
      "utf8",
    ),
    deflated,
    Buffer.from("\nendstream\nendobj\n", "utf8"),
  ]);
  return pdf.toString("base64");
}

function readPdfFixtureAsBase64(filePath: string): string {
  const binary = fs.readFileSync(filePath);
  return binary.toString("base64");
}

describe("parseTransactionImport (pdf)", () => {
  it("parseert Rabobank transacties uit gecomprimeerde PDF streams", () => {
    const pdfContent =
      "BT\n" +
      "/F0 8.5 Tf\n" +
      "36.850394 704.60663 Td\n" +
      "(IBAN / Rekeningnummer)Tj\n" +
      "36.850394 692.35467 Td\n" +
      "(NL32 RABO 0386 5598 05 EUR)Tj\n" +
      "405.11669 704.60663 Td\n" +
      "(Datum vanaf)Tj\n" +
      "395.45669 692.35467 Td\n" +
      "(01-03-2026)Tj\n" +
      "532.3601 674.19089 Td\n" +
      "(Beginsaldo)Tj\n" +
      "521.313 661.939 Td\n" +
      "(745,59 CR)Tj\n" +
      "536.3726 643.77514 Td\n" +
      "(Eindsaldo)Tj\n" +
      "521.313 631.523 Td\n" +
      "(531,82 CR)Tj\n" +
      "36.850394 583.2838 Td\n" +
      "(Rente )Tj\n" +
      "0 -6.3225 Td\n" +
      "(datum)Tj\n" +
      "36.850394 551.2172 Td\n" +
      "(01-03)Tj\n" +
      "68.88189 551.2172 Td\n" +
      "(tb)Tj\n" +
      "88.724409 551.2172 Td\n" +
      "(NL29 RABO 0363 2900 44)Tj\n" +
      "448.73622 551.2172 Td\n" +
      "(20,00)Tj\n" +
      "205.51181 550.88718 Td\n" +
      "(L.V. Flikweert)Tj\n" +
      "205.51181 541.23118 Td\n" +
      "(Kleedgeld)Tj\n" +
      "205.51181 530.75313 Td\n" +
      "(Verwerkingsdatum: 01-03-2026)Tj\n" +
      "36.850394 481.94261 Td\n" +
      "(06-03)Tj\n" +
      "68.88189 481.94261 Td\n" +
      "(cb)Tj\n" +
      "88.724409 481.94261 Td\n" +
      "(NL08 BUNQ 2156 6373 93)Tj\n" +
      "448.73622 481.94261 Td\n" +
      "(193,77)Tj\n" +
      "205.51181 481.6126 Td\n" +
      "(Stichting BLOX Custody)Tj\n" +
      "205.51181 471.9566 Td\n" +
      "(BLOX ID 6023959559e0)Tj\n" +
      "205.51181 461.47855 Td\n" +
      "(Transactiereferentie:)Tj\n" +
      "205.51181 451.82255 Td\n" +
      "(TRX-6023959559E0)Tj\n" +
      "205.51181 442.16655 Td\n" +
      "(Verwerkingsdatum: 06-03-2026)Tj\n" +
      "ET\n";

    const base64 = createCompressedRabobankPdfContent(pdfContent);
    const rows = parseTransactionImport("pdf", base64);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-03-01",
      amount: -20,
      currency: "EUR",
      counterparty: "L.V. Flikweert",
      details: "Kleedgeld",
      type: "tb",
    });
    expect(rows[0].metadata).toMatchObject({
      source: "pdf",
      IBAN: "NL32RABO0386559805",
      Rekeningnummer: "NL32RABO0386559805",
      Verwerkingsdatum: "01-03-2026",
      "Saldo na trn": "+725,59",
    });
    expect(rows[1]).toMatchObject({
      date: "2026-03-06",
      amount: -193.77,
      currency: "EUR",
      counterparty: "Stichting BLOX Custody",
      type: "cb",
    });
    expect(rows[1].details).toContain("BLOX ID 6023959559e0");
    expect(rows[1].metadata).toMatchObject({
      "Transactiereferentie": "TRX-6023959559E0",
      "Saldo na trn": "+531,82",
    });
  });

  it("behoudt detailregels na metadata-labels in Rabobank PDF transacties", () => {
    const pdfContent =
      "BT\n" +
      "/F0 8.5 Tf\n" +
      "36.850394 704.60663 Td\n" +
      "(IBAN / Rekeningnummer)Tj\n" +
      "36.850394 692.35467 Td\n" +
      "(NL32 RABO 0386 5598 05 EUR)Tj\n" +
      "405.11669 704.60663 Td\n" +
      "(Datum vanaf)Tj\n" +
      "395.45669 692.35467 Td\n" +
      "(01-03-2026)Tj\n" +
      "36.850394 551.2172 Td\n" +
      "(02-03)Tj\n" +
      "68.88189 551.2172 Td\n" +
      "(ei)Tj\n" +
      "88.724409 551.2172 Td\n" +
      "(NL49 RABO 0347 8026 64)Tj\n" +
      "443.64 551.2172 Td\n" +
      "(201,19)Tj\n" +
      "205.51181 550.88718 Td\n" +
      "(Unive Dichtbij Advies B.V.)Tj\n" +
      "205.51181 541.23118 Td\n" +
      "(Kenmerk machtiging / incassant ID:)Tj\n" +
      "205.51181 531.57518 Td\n" +
      "(32805-13022404)Tj\n" +
      "205.51181 521.91918 Td\n" +
      "(NL46ZZZ321186890000)Tj\n" +
      "205.51181 512.26318 Td\n" +
      "(Unive Premie 01-03-2026 / 31-03-2026)Tj\n" +
      "205.51181 502.60718 Td\n" +
      "(Op mijnunive.nl vindt u meer informatie.)Tj\n" +
      "205.51181 492.95118 Td\n" +
      "(Transactiereferentie:)Tj\n" +
      "205.51181 483.29518 Td\n" +
      "(5000000064329465)Tj\n" +
      "205.51181 473.63918 Td\n" +
      "(Verwerkingsdatum: 02-03-2026)Tj\n" +
      "ET\n";

    const base64 = createCompressedRabobankPdfContent(pdfContent);
    const rows = parseTransactionImport("pdf", base64);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-03-02",
      amount: -201.19,
      counterparty: "Unive Dichtbij Advies B.V.",
      type: "ei",
    });
    expect(rows[0].details).toContain("Unive Premie 01-03-2026 / 31-03-2026");
    expect(rows[0].details).not.toContain("NL46ZZZ321186890000");
    expect(rows[0].details).not.toBe("Unive Dichtbij Advies B.V.");
    expect(rows[0].metadata).toMatchObject({
      "Kenmerk machtiging / incassant ID": "32805-13022404",
      "Transactiereferentie": "5000000064329465",
    });
  });

  it("combineert afgebroken regels, negeert paginakop-ruis en houdt db-details bruikbaar", () => {
    const pdfContent =
      "BT\n" +
      "/F0 8.5 Tf\n" +
      "36.850394 704.60663 Td\n" +
      "(IBAN / Rekeningnummer)Tj\n" +
      "36.850394 692.35467 Td\n" +
      "(NL32 RABO 0386 5598 05 EUR)Tj\n" +
      "405.11669 704.60663 Td\n" +
      "(Datum vanaf)Tj\n" +
      "395.45669 692.35467 Td\n" +
      "(01-03-2026)Tj\n" +
      "36.850394 551.2172 Td\n" +
      "(14-03)Tj\n" +
      "68.88189 551.2172 Td\n" +
      "(db)Tj\n" +
      "205.51181 550.88718 Td\n" +
      "(Eff.nota Tarieven en services 117-)Tj\n" +
      "448.73622 551.2172 Td\n" +
      "(5,20)Tj\n" +
      "205.51181 541.23118 Td\n" +
      "(22860979-23126957)Tj\n" +
      "205.51181 531.57518 Td\n" +
      "(3 van 15)Tj\n" +
      "205.51181 521.91918 Td\n" +
      "(Naam/omschrijving)Tj\n" +
      "205.51181 512.26318 Td\n" +
      "(Bedrag af (debet))Tj\n" +
      "205.51181 502.60718 Td\n" +
      "(Verwerkingsdatum: 14-03-2026)Tj\n" +
      "ET\n";

    const base64 = createCompressedRabobankPdfContent(pdfContent);
    const rows = parseTransactionImport("pdf", base64);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-03-14",
      amount: -5.2,
      type: "db",
      counterparty: "",
      details: "Eff.nota Tarieven en services 117-22860979-23126957",
    });
  });

  const fixturePath = process.env.RABOBANK_PDF_FIXTURE
    ? path.resolve(process.cwd(), process.env.RABOBANK_PDF_FIXTURE)
    : path.resolve(process.cwd(), "tmp/import-fixtures/rabobank-transactions.pdf");
  const hasFixture = fs.existsSync(fixturePath);
  const maybeDescribe = hasFixture ? describe : describe.skip;

  maybeDescribe("met echte Rabobank PDF fixture", () => {
    it("herkent de huidige maandexport met dezelfde rijcount als de CSV", () => {
      const base64 = readPdfFixtureAsBase64(fixturePath);
      const rows = parseTransactionImport("pdf", base64);

      expect(rows).toHaveLength(85);
      expect(rows[0]).toMatchObject({
        date: "2026-03-01",
        amount: -20,
        counterparty: "L.V. Flikweert",
        details: "Kleedgeld",
        type: "tb",
        currency: "EUR",
      });
      expect(rows.at(-1)).toMatchObject({
        date: "2026-03-23",
        amount: -8.53,
        counterparty: "Plus Greidanus",
        currency: "EUR",
        type: "bc",
      });
      for (const row of rows) {
        expect(row.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(Number.isFinite(row.amount)).toBe(true);
        expect(row.currency).toBe("EUR");
        expect(row.type.length).toBeGreaterThan(0);
        expect(row.details.length).toBeGreaterThan(0);
      }
    });
  });

  const csvFixturePath = process.env.RABOBANK_CSV_FIXTURE
    ? path.resolve(process.cwd(), process.env.RABOBANK_CSV_FIXTURE)
    : "/Users/pieterflikweert/Downloads/CSV_A_NL32RABO0386559805_EUR_20260301_20260323.csv";
  const hasCsvFixture = fs.existsSync(csvFixturePath) && hasFixture;
  const maybeDescribeCsv = hasCsvFixture ? describe : describe.skip;

  maybeDescribeCsv("vergelijking met CSV fixture", () => {
    it("geeft dezelfde saldo-reeks als de CSV export", () => {
      const pdfRows = parseTransactionImport("pdf", readPdfFixtureAsBase64(fixturePath));
      const csvContent = fs.readFileSync(csvFixturePath, "utf8");
      const csvRows = parseTransactionImport("csv", csvContent);

      expect(pdfRows).toHaveLength(csvRows.length);

      pdfRows.forEach((row, index) => {
        const csvRow = csvRows[index];
        expect(row.date).toBe(csvRow.date);
        expect(row.amount).toBe(csvRow.amount);
        expect(row.details).toBe(csvRow.details);
        expect(row.metadata["Saldo na trn"]).toBe(csvRow.metadata["Saldo na trn"]);
      });
    });
  });
});
