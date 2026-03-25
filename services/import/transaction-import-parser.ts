import Papa from "papaparse";
import { inflateSync, unzlibSync } from "fflate";

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

type PdfTextItem = {
  x: number;
  y: number;
  text: string;
};

type PdfTransactionBlock = {
  shortDate: string | null;
  fullDate: string | null;
  type: string | null;
  counterparty: string | null;
  amount: number | null;
  amountX: number | null;
  detailLines: string[];
  metadata: Record<string, string>;
  suppressDetailLines: boolean;
};

type PdfStatementBalances = {
  openingBalance: number | null;
  closingBalance: number | null;
};

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

const PDF_STREAM_MAX_BYTES = 250_000;
const PDF_DEBIT_AMOUNT_X = 490;
const PDF_TRANSACTION_START_X = 60;
const PDF_TYPE_MAX_X = 110;
const PDF_COUNTERPARTY_MAX_X = 190;
const PDF_DETAIL_MIN_X = 190;
const PDF_DETAIL_IGNORE_PATTERNS = [
  /^Verwerkingsdatum:/i,
  /^Periode\b/i,
  /^CR\s*=\s*tegoed\b/i,
  /^D\s*=\s*tekort\b/i,
  /^Totaal /i,
  /^Datum /i,
  /^Blad\b/i,
];

const PDF_METADATA_LABELS = new Map<string, string>([
  ["Transactiereferentie:", "Transactiereferentie"],
  ["Kenmerk machtiging / incassant ID:", "Kenmerk machtiging / incassant ID"],
  ["Incassant ID:", "Incassant ID"],
  ["Machtigingskenmerk:", "Machtigingskenmerk"],
  ["Batch ID:", "Batch ID"],
  ["Betalingskenmerk:", "Betalingskenmerk"],
]);

function toTrimmedString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function decodeBase64ToBytes(base64Content: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64Content);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index) & 0xff;
    }
    return bytes;
  }

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const clean = base64Content.replace(/[^A-Za-z0-9+/=]/g, "");
  const output = new Uint8Array(Math.ceil((clean.length * 3) / 4));
  let outputIndex = 0;
  let index = 0;

  while (index < clean.length) {
    const enc1 = chars.indexOf(clean.charAt(index++));
    const enc2 = chars.indexOf(clean.charAt(index++));
    const enc3 = chars.indexOf(clean.charAt(index++));
    const enc4 = chars.indexOf(clean.charAt(index++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output[outputIndex++] = chr1 & 0xff;
    if (enc3 !== 64 && outputIndex < output.length) {
      output[outputIndex++] = chr2 & 0xff;
    }
    if (enc4 !== 64 && outputIndex < output.length) {
      output[outputIndex++] = chr3 & 0xff;
    }
  }

  return output.subarray(0, outputIndex);
}

function bytesToLatin1(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let output = "";
  for (let index = 0; index < bytes.length; index += chunkSize) {
    output += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return output;
}

function latin1ToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

function decodePdfString(value: string): string {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      output += char;
      continue;
    }

    index += 1;
    const escaped = value[index];
    if (!escaped) break;

    if (escaped === "\n" || escaped === "\r") {
      if (escaped === "\r" && value[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    if (escaped === "n") {
      output += "\n";
      continue;
    }
    if (escaped === "r") {
      output += "\r";
      continue;
    }
    if (escaped === "t") {
      output += "\t";
      continue;
    }
    if (escaped === "b") {
      output += "\b";
      continue;
    }
    if (escaped === "f") {
      output += "\f";
      continue;
    }
    if (escaped === "(" || escaped === ")" || escaped === "\\") {
      output += escaped;
      continue;
    }

    if (/[0-7]/.test(escaped)) {
      let octal = escaped;
      while (index + 1 < value.length && octal.length < 3 && /[0-7]/.test(value[index + 1])) {
        index += 1;
        octal += value[index];
      }
      output += String.fromCharCode(Number.parseInt(octal, 8));
      continue;
    }

    output += escaped;
  }

  return output;
}

function normalizeStatementAccountHint(value: string): string | null {
  const stripped = value.replace(/\s+[A-Z]{3}$/i, "").trim();
  const compact = stripped.replace(/\s+/g, "");
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,}$/i.test(compact) ? compact.toUpperCase() : null;
}

function normalizePdfText(value: string): string {
  return decodePdfString(value)
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isIgnoredPdfDetailLine(value: string): boolean {
  return PDF_DETAIL_IGNORE_PATTERNS.some((pattern) => pattern.test(value));
}

function parsePdfAmountLine(value: string): number | null {
  const normalized = value.replace(/\s+/g, "").replace(/[.](?=\d{3}(?:,|$))/g, "");
  if (!/^\d+(?:,\d{2})?$/.test(normalized)) {
    return null;
  }
  return normalizeImportAmount(normalized);
}

function normalizePdfMetadataValue(value: string): string {
  return value.replace(/\s*\|\s*$/, "").trim();
}

function formatPdfBalanceValue(value: number): string {
  const sign = value < 0 ? "-" : "+";
  const absolute = Math.abs(value).toFixed(2).replace(".", ",");
  return `${sign}${absolute}`;
}

function parsePdfBalanceValue(value: string): number | null {
  const compact = value.replace(/\s+/g, " ").trim();
  const match = compact.match(/^([+\-]?\d+(?:\.\d{3})*(?:,\d{2})?)\s*(CR|D)$/i);
  if (!match) return null;

  const raw = match[1];
  const amount = normalizeImportAmount(raw);
  if (amount == null) return null;

  const sign = match[2].toUpperCase() === "D" ? -1 : 1;
  return sign * Math.abs(amount);
}

function isPdfMetadataLabel(value: string): string | null {
  for (const [label, metadataKey] of PDF_METADATA_LABELS.entries()) {
    if (value.startsWith(label)) {
      return metadataKey;
    }
  }
  return null;
}

function extractPdfTextItems(binaryPdf: string): PdfTextItem[] {
  const items: PdfTextItem[] = [];
  const blockRegex = /BT([\s\S]*?)ET/g;
  let blockMatch = blockRegex.exec(binaryPdf);

  while (blockMatch) {
    const block = blockMatch[1];
    const itemRegex =
      /([-\d.]+)\s+([-\d.]+)\s+Td\s*(?:\r?\n|\s)*(\((?:\\.|[^\\()])*\)|\[(?:[\s\S]*?)\])\s*T([Jj])/g;
    let itemMatch = itemRegex.exec(block);

    while (itemMatch) {
      const x = Number.parseFloat(itemMatch[1]);
      const y = Number.parseFloat(itemMatch[2]);
      const payload = itemMatch[3];
      const op = itemMatch[4];

      if (Number.isFinite(x) && Number.isFinite(y)) {
        if (payload.startsWith("(") && payload.endsWith(")")) {
          items.push({
            x,
            y,
            text: normalizePdfText(payload.slice(1, -1)),
          });
        } else if (op === "J") {
          const parts = [...payload.matchAll(/\((?:\\.|[^\\()])*\)/g)]
            .map((match) => normalizePdfText(match[0].slice(1, -1)))
            .filter(Boolean);
          if (parts.length) {
            items.push({
              x,
              y,
              text: parts.join(" "),
            });
          }
        }
      }

      itemMatch = itemRegex.exec(block);
    }

    blockMatch = blockRegex.exec(binaryPdf);
  }

  return items;
}

function extractPdfContentStreams(binaryPdf: string): string[] {
  const streams: string[] = [];
  const streamRegex = /stream\r?\n/g;
  let streamMatch = streamRegex.exec(binaryPdf);

  while (streamMatch) {
    const start = streamMatch.index + streamMatch[0].length;
    const end = binaryPdf.indexOf("endstream", start);
    if (end < 0) break;

    const chunk = binaryPdf.slice(start, end).replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    if (chunk.length > PDF_STREAM_MAX_BYTES) {
      streamRegex.lastIndex = end + "endstream".length;
      streamMatch = streamRegex.exec(binaryPdf);
      continue;
    }

    const bytes = latin1ToBytes(chunk);
    try {
      const inflated = unzlibSync(bytes);
      const inflatedText = bytesToLatin1(inflated);
      if (/BT[\s\S]*T[Jj]/.test(inflatedText)) {
        streams.push(inflatedText);
      }
    } catch {
      try {
        const inflated = inflateSync(bytes);
        const inflatedText = bytesToLatin1(inflated);
        if (/BT[\s\S]*T[Jj]/.test(inflatedText)) {
          streams.push(inflatedText);
        }
      } catch {
        if (/BT[\s\S]*T[Jj]/.test(chunk)) {
          streams.push(chunk);
        }
      }
    }

    streamRegex.lastIndex = end + "endstream".length;
    streamMatch = streamRegex.exec(binaryPdf);
  }

  return streams;
}

function resolveStatementStartDate(items: PdfTextItem[]): string | null {
  let awaitingStartDate = false;

  for (const item of items) {
    if (/^Datum vanaf$/i.test(item.text)) {
      awaitingStartDate = true;
      continue;
    }

    if (awaitingStartDate && /^\d{2}-\d{2}-\d{4}$/.test(item.text)) {
      const resolved = normalizeImportDate(item.text);
      if (resolved) return resolved;
    }

    if (/^Datum tot en met$/i.test(item.text)) {
      awaitingStartDate = false;
    }
  }

  for (const item of items) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(item.text)) {
      const resolved = normalizeImportDate(item.text);
      if (resolved) return resolved;
    }
  }

  return null;
}

function resolveStatementAccountHint(items: PdfTextItem[]): string | null {
  let awaitingAccount = false;

  for (const item of items) {
    if (/^IBAN \/ Rekeningnummer$/i.test(item.text)) {
      awaitingAccount = true;
      continue;
    }

    if (awaitingAccount) {
      const normalized = normalizeStatementAccountHint(item.text);
      if (normalized) return normalized;
    }
  }

  return null;
}

function resolveStatementBalances(items: PdfTextItem[]): PdfStatementBalances {
  let awaiting: "opening" | "closing" | null = null;
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  for (const item of items) {
    if (/^Beginsaldo$/i.test(item.text)) {
      awaiting = "opening";
      continue;
    }

    if (/^Eindsaldo$/i.test(item.text)) {
      awaiting = "closing";
      continue;
    }

    if (!awaiting || item.x < 500) {
      continue;
    }

    const balance = parsePdfBalanceValue(item.text);
    if (balance == null) continue;

    if (awaiting === "opening") {
      openingBalance = balance;
    } else if (awaiting === "closing") {
      closingBalance = balance;
    }
    awaiting = null;

    if (openingBalance != null && closingBalance != null) {
      break;
    }
  }

  return { openingBalance, closingBalance };
}

function resolveTransactionDate(
  shortDate: string | null,
  fullDate: string | null,
  statementStartDate: string | null,
): string | null {
  if (fullDate) {
    return normalizeImportDate(fullDate);
  }

  if (!shortDate || !statementStartDate) {
    return null;
  }

  const [year] = statementStartDate.split("-");
  const [day, month] = shortDate.split("-");
  if (!year || !day || !month) {
    return null;
  }

  return normalizeImportDate(`${year}-${month}-${day}`);
}

function finalizePdfBlock(
  block: PdfTransactionBlock,
  seq: number,
  statementStartDate: string | null,
  statementAccountHint: string | null,
): TransactionImportRecord | null {
  const date = resolveTransactionDate(block.shortDate, block.fullDate, statementStartDate);
  const amount = block.amount;
  if (!date || amount == null) {
    return null;
  }

  const detailLines = block.detailLines.filter(
    (line) => line && !isIgnoredPdfDetailLine(line),
  );
  const firstDetailLine = detailLines[0] || "";
  const rawCounterparty = toTrimmedString(block.counterparty || "");
  const normalizedCounterpartyHint = normalizeStatementAccountHint(rawCounterparty);
  const hasAccountLikeCounterparty = Boolean(normalizedCounterpartyHint);

  let counterparty = rawCounterparty;
  let detailsToUse = detailLines;

  if (
    !counterparty ||
    hasAccountLikeCounterparty ||
    /^\d{2}-\d{2}-\d{4}$/.test(counterparty) ||
    counterparty === statementAccountHint
  ) {
    counterparty = firstDetailLine || counterparty;
    if (firstDetailLine) {
      detailsToUse = detailLines.slice(1);
    }
  }

  const details = normalizeTransactionDetails(detailsToUse.join(" | "));
  const fallbackDetails = normalizeTransactionDetails(firstDetailLine);
  const resolvedDetails = details || fallbackDetails;
  if (!resolvedDetails) {
    return null;
  }

  const metadata: Record<string, string> = {
    source: "pdf",
    ...block.metadata,
  };

  if (statementAccountHint) {
    metadata.IBAN = statementAccountHint;
    metadata.Rekeningnummer = statementAccountHint;
    metadata.Rekening = statementAccountHint;
  }

  if (normalizedCounterpartyHint) {
    metadata["Tegenrekening IBAN/BBAN"] = normalizedCounterpartyHint;
  }

  if (block.fullDate) {
    metadata["Verwerkingsdatum"] = block.fullDate;
  }

  if (block.shortDate) {
    metadata["Datum"] = block.shortDate;
  }

  return {
    date,
    details: resolvedDetails,
    counterparty,
    amount,
    currency: "EUR",
    type: toTrimmedString(block.type || "PDF"),
    metadata,
    seq,
  };
}

function backfillPdfBalances(
  records: TransactionImportRecord[],
  balances: PdfStatementBalances,
): TransactionImportRecord[] {
  if (!records.length) return records;

  const hasAnyExistingBalance = records.some((record) => {
    const value = record.metadata["Saldo na trn"];
    return value != null && String(value).trim().length > 0;
  });
  if (hasAnyExistingBalance) return records;

  const withBalances = records.map((record) => ({
    ...record,
    metadata: { ...record.metadata },
  }));

  if (balances.openingBalance != null) {
    let running = balances.openingBalance;
    for (const record of withBalances) {
      running += record.amount;
      record.metadata["Saldo na trn"] = formatPdfBalanceValue(running);
    }
    return withBalances;
  }

  if (balances.closingBalance != null) {
    let running = balances.closingBalance;
    for (let index = withBalances.length - 1; index >= 0; index -= 1) {
      const record = withBalances[index];
      record.metadata["Saldo na trn"] = formatPdfBalanceValue(running);
      running -= record.amount;
    }
  }

  return withBalances;
}

function parsePdfContent(base64Content: string): TransactionImportRecord[] {
  const binaryPdf = bytesToLatin1(decodeBase64ToBytes(base64Content));
  const contentStreams = extractPdfContentStreams(binaryPdf);
  const items = contentStreams.flatMap((stream) => extractPdfTextItems(stream));

  if (!items.length) {
    return [];
  }

  const statementStartDate = resolveStatementStartDate(items);
  const statementAccountHint = resolveStatementAccountHint(items);
  const statementBalances = resolveStatementBalances(items);
  const records: TransactionImportRecord[] = [];
  let currentBlock: PdfTransactionBlock | null = null;

  const finalizeCurrentBlock = () => {
    if (!currentBlock) return;
    const record = finalizePdfBlock(
      currentBlock,
      records.length + 1,
      statementStartDate,
      statementAccountHint,
    );
    if (record) {
      records.push(record);
    }
    currentBlock = null;
  };

  for (const item of items) {
    const text = item.text.trim();
    if (!text) continue;

    if (item.x <= PDF_TRANSACTION_START_X && /^\d{2}-\d{2}$/.test(text)) {
      finalizeCurrentBlock();
      currentBlock = {
        shortDate: text,
        fullDate: null,
        type: null,
        counterparty: null,
        amount: null,
        amountX: null,
        detailLines: [],
        metadata: {},
        suppressDetailLines: false,
      };
      continue;
    }

    if (!currentBlock) {
      continue;
    }

    const fullDateMatch = text.match(/^Verwerkingsdatum:\s*(\d{2}-\d{2}-\d{4})$/i);
    if (fullDateMatch) {
      currentBlock.fullDate = fullDateMatch[1];
      continue;
    }

    const metadataLabel = isPdfMetadataLabel(text);
    if (metadataLabel) {
      currentBlock.metadata[metadataLabel] = "";
      currentBlock.suppressDetailLines = true;
      continue;
    }

    if (
      !currentBlock.type &&
      item.x >= PDF_TRANSACTION_START_X &&
      item.x <= PDF_TYPE_MAX_X &&
      /^[a-z]{2}$/i.test(text)
    ) {
      currentBlock.type = text.toLowerCase();
      continue;
    }

    if (
      !currentBlock.counterparty &&
      currentBlock.amount == null &&
      item.x >= PDF_TYPE_MAX_X &&
      item.x <= PDF_COUNTERPARTY_MAX_X &&
      !parsePdfAmountLine(text) &&
      !isIgnoredPdfDetailLine(text)
    ) {
      currentBlock.counterparty = text;
      continue;
    }

    const metadataKeys = Object.keys(currentBlock.metadata);
    const activeMetadataKey = metadataKeys[metadataKeys.length - 1];
    if (activeMetadataKey && !currentBlock.metadata[activeMetadataKey]) {
      currentBlock.metadata[activeMetadataKey] = normalizePdfMetadataValue(text);
      continue;
    }

    const amount = parsePdfAmountLine(text);
    if (
      amount != null &&
      currentBlock.amount == null &&
      item.x >= PDF_DETAIL_MIN_X
    ) {
      currentBlock.amount = item.x >= PDF_DEBIT_AMOUNT_X ? amount : -amount;
      currentBlock.amountX = item.x;
      continue;
    }

    if (item.x >= PDF_DETAIL_MIN_X) {
      if (currentBlock.suppressDetailLines) {
        continue;
      }
      currentBlock.detailLines.push(text);
    }
  }

  finalizeCurrentBlock();

  return backfillPdfBalances(
    records.sort((left, right) => left.seq - right.seq || left.date.localeCompare(right.date)),
    statementBalances,
  );
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
  metadata.IBAN =
    row.IBAN ||
    row["IBAN/BBAN"] ||
    row["IBAN / BBAN"] ||
    row["Rekening IBAN/BBAN"] ||
    row["Rekening IBAN / BBAN"] ||
    "";
  metadata["IBAN/BBAN"] = row["IBAN/BBAN"] || row["IBAN / BBAN"] || "";
  metadata["IBAN / BBAN"] = row["IBAN / BBAN"] || row["IBAN/BBAN"] || "";
  metadata["Rekening IBAN/BBAN"] =
    row["Rekening IBAN/BBAN"] || row["Rekening IBAN / BBAN"] || "";
  metadata["Rekening IBAN / BBAN"] =
    row["Rekening IBAN / BBAN"] || row["Rekening IBAN/BBAN"] || "";
  metadata.Rekeningnummer =
    row.Rekeningnummer ||
    row["Rekening nummer"] ||
    row["IBAN/BBAN"] ||
    row["IBAN / BBAN"] ||
    "";
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

export function parseTransactionImport(
  source: ImportSource,
  content: string,
): TransactionImportRecord[] {
  if (source === "pdf") {
    return parsePdfContent(content);
  }
  return parseCsvContent(content);
}
