import Papa from "papaparse";

import { normalizeImportRows } from "./normalizer";
import type { NormalizedImportTransaction } from "./types";

type CsvRow = Record<string, string>;
type CsvParseError = {
  type: string;
  code: string;
  message: string;
  row?: number;
  index?: number;
};

export function parseCsvImportTransactions(csv: string): {
  rows: NormalizedImportTransaction[];
  parseErrors: CsvParseError[];
  firstRawRow: CsvRow | null;
} {
  const { data, errors } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const rawRows = (data as CsvRow[]) || [];

  return {
    rows: normalizeImportRows(rawRows),
    parseErrors: (errors || []) as CsvParseError[],
    firstRawRow: rawRows[0] ?? null,
  };
}
