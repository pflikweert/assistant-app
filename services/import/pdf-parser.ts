import { normalizeImportRows } from "./normalizer";
import type { NormalizedImportTransaction } from "./types";

type PdfRow = Record<string, unknown>;

export function parsePdfImportTransactions(rows: PdfRow[]): NormalizedImportTransaction[] {
  return normalizeImportRows(rows);
}
