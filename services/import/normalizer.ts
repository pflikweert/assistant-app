import type { NormalizedImportTransaction } from "./types";

type RawImportRow = Record<string, unknown>;

const DATE_HEADERS = ["Datum", "Date"];
const AMOUNT_HEADERS = ["Bedrag", "Amount"];
const CURRENCY_HEADERS = ["Munt", "Currency"];
const DESCRIPTION_HEADERS = [
  "Omschrijving-1",
  "Omschrijving-2",
  "Omschrijving-3",
  "Naam tegenpartij",
  "Naam / Omschrijving",
];
const COUNTERPARTY_HEADERS = [
  "Naam tegenpartij",
  "Naam uiteindelijke partij",
  "Tegenrekening IBAN/BBAN",
];
const TYPE_HEADERS = ["Code", "Type"];
const SEQ_HEADERS = ["Volgnr", "Seq", "Sequence"];

function toTrimmedString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function getFirstValue(row: RawImportRow, headers: string[]): string {
  for (const header of headers) {
    const value = toTrimmedString(row[header]);
    if (value) return value;
  }
  return "";
}

function parseDdMmYyyy(input: string): string | null {
  const match = input.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return `${year.toString().padStart(4, "0")}-${month
    .toString()
    .padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function normalizeImportDate(value: unknown): string | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const local = parseDdMmYyyy(raw);
  if (local) return local;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function normalizeImportAmount(value: unknown): number | null {
  const raw = toTrimmedString(value);
  if (!raw) return null;

  const compact = raw.replace(/\s/g, "");
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");

  let normalized = compact;
  if (hasComma && hasDot) {
    if (compact.lastIndexOf(",") > compact.lastIndexOf(".")) {
      normalized = compact.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = compact.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = compact.replace(",", ".");
  }

  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) return null;
  return amount;
}

function isEmptyRecord(row: RawImportRow): boolean {
  return Object.values(row).every((value) => !toTrimmedString(value));
}

function buildDetails(row: RawImportRow): string {
  const details = DESCRIPTION_HEADERS.map((header) => toTrimmedString(row[header]))
    .filter(Boolean)
    .join(" | ");
  return details;
}

function resolveMetadata(row: RawImportRow): Record<string, string> {
  const knownHeaders = new Set([
    ...DATE_HEADERS,
    ...AMOUNT_HEADERS,
    ...CURRENCY_HEADERS,
    ...DESCRIPTION_HEADERS,
    ...COUNTERPARTY_HEADERS,
    ...TYPE_HEADERS,
    ...SEQ_HEADERS,
  ]);

  const metadata: Record<string, string> = {};
  Object.entries(row).forEach(([key, value]) => {
    if (knownHeaders.has(key)) return;
    const normalizedValue = toTrimmedString(value);
    if (normalizedValue) {
      metadata[key] = normalizedValue;
    }
  });

  return metadata;
}

function resolveSeq(row: RawImportRow, metadata: Record<string, string>): number | undefined {
  const seqRaw = getFirstValue(row, SEQ_HEADERS) || toTrimmedString(metadata.Volgnr);
  if (!seqRaw) return undefined;
  const seq = Number.parseInt(seqRaw.replace(/^0+/, ""), 10);
  if (Number.isNaN(seq)) return undefined;
  return seq;
}

export function normalizeImportRows(rows: RawImportRow[]): NormalizedImportTransaction[] {
  return rows
    .filter((row) => !isEmptyRecord(row))
    .map((row) => {
      const date = normalizeImportDate(getFirstValue(row, DATE_HEADERS));
      const amount = normalizeImportAmount(getFirstValue(row, AMOUNT_HEADERS));
      const details = buildDetails(row);

      if (!date || amount == null || !details) {
        return null;
      }

      const metadata = resolveMetadata(row);
      const counterparty = getFirstValue(row, COUNTERPARTY_HEADERS) || undefined;
      const currency = getFirstValue(row, CURRENCY_HEADERS) || undefined;
      const type = getFirstValue(row, TYPE_HEADERS) || undefined;
      const seq = resolveSeq(row, metadata);

      const normalized: NormalizedImportTransaction = {
        date,
        amount,
        details,
        counterparty,
        currency,
        type,
        metadata: Object.keys(metadata).length ? metadata : undefined,
        seq,
      };

      return normalized;
    })
    .filter((row): row is NormalizedImportTransaction => Boolean(row));
}
