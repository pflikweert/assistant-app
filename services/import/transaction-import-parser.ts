import Papa from "papaparse";

import { normalizeImportAmount, normalizeImportDate } from "./normalizer";
import { normalizeTransactionDetails } from "../transaction-details";

export type ImportSource = "csv" | "pdf";

export type TransactionImportRecord = {
  date: string;
  details: string;
  counterparty: string;
  amount: number;
  currency: string;
  type: string;
  metadata: Record<string, string>;
  seq: number;
};

type CsvRow = Record<string, string>;

const NORMALIZED_KEYS = new Set([
  "Datum",
  "Bedrag",
  "Munt",
  "Omschrijving-1",
  "Omschrijving-2",
  "Omschrijving-3",
  "Naam tegenpartij",
  "Naam uiteindelijke partij",
  "Tegenrekening IBAN/BBAN",
  "Naam / Omschrijving",
  "Code",
  "Type",
]);

function toTrimmedString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function mapCsvRow(row: CsvRow): TransactionImportRecord | null {
  const date = normalizeImportDate(row["Datum"] || row.Date || "");
  const amount = normalizeImportAmount(row["Bedrag"] || row.Amount || "0");
  const currency = toTrimmedString(row["Munt"] || row.Currency || "EUR") || "EUR";
  const descParts: string[] = [];

  if (row["Omschrijving-1"]) descParts.push(row["Omschrijving-1"]);
  if (row["Omschrijving-2"]) descParts.push(row["Omschrijving-2"]);
  if (row["Omschrijving-3"]) descParts.push(row["Omschrijving-3"]);
  if (row["Naam tegenpartij"]) descParts.push(row["Naam tegenpartij"]);
  if (row["Naam / Omschrijving"]) descParts.push(row["Naam / Omschrijving"]);

  const details = normalizeTransactionDetails(
    descParts
      .map((part) => toTrimmedString(part))
      .filter(Boolean)
      .join(" | ") || toTrimmedString(row["Naam / Omschrijving"]),
  );

  if (!date || amount == null || !details) {
    return null;
  }

  const metadata: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (!NORMALIZED_KEYS.has(key)) {
      metadata[key] = toTrimmedString(value);
    }
  });

  // Preserve raw account hints for account detection during import preview.
  metadata["Tegenrekening IBAN/BBAN"] = row["Tegenrekening IBAN/BBAN"] || "";
  metadata.IBAN = row.IBAN || "";
  metadata.Rekeningnummer = row.Rekeningnummer || row["Rekening nummer"] || "";
  metadata["Rekening nummer"] = row["Rekening nummer"] || "";
  metadata.Rekening = row.Rekening || "";

  const seqRaw = row["Volgnr"] || metadata.Volgnr || "";
  const seq = Number.parseInt(String(seqRaw).replace(/^0+/, ""), 10) || 0;

  return {
    date,
    details,
    counterparty:
      toTrimmedString(row["Naam tegenpartij"]) ||
      toTrimmedString(row["Naam uiteindelijke partij"]) ||
      toTrimmedString(row["Tegenrekening IBAN/BBAN"]) ||
      "",
    amount,
    currency,
    type: toTrimmedString(row["Code"] || row["Type"] || ""),
    metadata,
    seq,
  };
}

function parseCsvContent(content: string): TransactionImportRecord[] {
  const { data, errors } = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (errors.length) {
    console.warn("[transaction-import-parser] CSV parse errors", errors);
  }

  return (data as CsvRow[])
    .map(mapCsvRow)
    .filter((row): row is TransactionImportRecord => Boolean(row))
    .sort((left, right) => left.seq - right.seq || left.date.localeCompare(right.date));
}

function decodePdfBase64(base64Content: string): string {
  if (typeof atob === "function") {
    return atob(base64Content);
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  let index = 0;

  while (index < base64Content.length) {
    const enc1 = chars.indexOf(base64Content.charAt(index++));
    const enc2 = chars.indexOf(base64Content.charAt(index++));
    const enc3 = chars.indexOf(base64Content.charAt(index++));
    const enc4 = chars.indexOf(base64Content.charAt(index++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }

  return output;
}

function extractPdfText(binaryPdf: string): string {
  const textSegments: string[] = [];

  const tjRegex = /\(([^()]*)\)\s*Tj/g;
  let match = tjRegex.exec(binaryPdf);
  while (match) {
    textSegments.push(match[1]);
    match = tjRegex.exec(binaryPdf);
  }

  const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
  let arrayMatch = tjArrayRegex.exec(binaryPdf);
  while (arrayMatch) {
    const strings = [...arrayMatch[1].matchAll(/\(([^()]*)\)/g)].map(
      (item) => item[1],
    );
    if (strings.length) {
      textSegments.push(strings.join(" "));
    }
    arrayMatch = tjArrayRegex.exec(binaryPdf);
  }

  if (textSegments.length) {
    return textSegments
      .join("\n")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\n/g, "\n");
  }

  return binaryPdf
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ");
}

function parsePdfLine(
  line: string,
  seq: number,
): TransactionImportRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const amountMatch = trimmed.match(
    /(-?\d{1,3}(?:[.\s]\d{3})*,\d{2})\s*(EUR)?\s*$/i,
  );
  const dateMatch = trimmed.match(/(\d{2}-\d{2}-\d{4})/);
  if (!amountMatch || !dateMatch) return null;

  const date = normalizeImportDate(dateMatch[1]);
  const amount = normalizeImportAmount(amountMatch[1]);
  if (!date || amount == null) return null;

  const withoutAmount = trimmed.slice(0, amountMatch.index).trim();
  const details = withoutAmount.replace(dateMatch[1], "").trim();
  const detailParts = details
    .split(/\s{2,}|\|/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    date,
    details: normalizeTransactionDetails(details || trimmed),
    counterparty: detailParts[0] || "",
    amount,
    currency: amountMatch[2]?.toUpperCase() || "EUR",
    type: "PDF",
    metadata: { rawLine: trimmed },
    seq,
  };
}

function parsePdfContent(base64Content: string): TransactionImportRecord[] {
  const binaryPdf = decodePdfBase64(base64Content);
  const extractedText = extractPdfText(binaryPdf);
  const lines = extractedText
    .split(/\r?\n/)
    .map((line) => line.replace(/\u0000/g, "").trim())
    .filter(Boolean);

  const records: TransactionImportRecord[] = [];
  lines.forEach((line, index) => {
    const parsed = parsePdfLine(line, index + 1);
    if (parsed) {
      records.push(parsed);
    }
  });

  return records.sort((left, right) => {
    return left.seq - right.seq || left.date.localeCompare(right.date);
  });
}

export function parseTransactionImport(
  source: ImportSource,
  content: string,
): TransactionImportRecord[] {
  if (source === "pdf") {
    return parsePdfContent(content);
  }
  return parseCsvContent(content);
}
