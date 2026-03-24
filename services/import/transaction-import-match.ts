type ImportMetadata = Record<string, unknown> | Record<string, string> | undefined;

export type ImportedTransactionMatchCandidate = {
  id: string;
  details?: string | null;
  counterparty?: string | null;
  metadata?: ImportMetadata;
};

export type IncomingImportTransaction = {
  details: string;
  counterparty: string;
  metadata?: Record<string, string>;
};

const REFERENCE_KEYS = new Set([
  "Transactiereferentie",
  "Betalingskenmerk",
  "Machtigingskenmerk",
  "Kenmerk machtiging / incassant ID",
  "Batch ID",
  "Incassant ID",
  "BLOX ID",
]);

function toTrimmedString(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeValue(value: unknown): string {
  return toTrimmedString(value).replace(/\s+/g, " ");
}

function collectReferenceValues(metadata?: ImportMetadata): Set<string> {
  const values = new Set<string>();
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return values;
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (!REFERENCE_KEYS.has(key)) continue;
    const normalized = normalizeValue(value);
    if (normalized) {
      values.add(normalized);
    }
  }

  return values;
}

function resolveNormalizedDetails(value?: string | null): string {
  return normalizeValue(value || "");
}

export function findMatchingImportedTransaction(
  existingRows: ImportedTransactionMatchCandidate[] | null | undefined,
  incoming: IncomingImportTransaction,
): ImportedTransactionMatchCandidate | null {
  const candidates = existingRows || [];
  if (!candidates.length) return null;

  const incomingReferenceValues = collectReferenceValues(incoming.metadata);

  if (incomingReferenceValues.size) {
    const referenceMatch = candidates.find((row) => {
      const rowReferenceValues = collectReferenceValues(row.metadata);
      for (const value of incomingReferenceValues) {
        if (rowReferenceValues.has(value)) {
          return true;
        }
      }
      return false;
    });

    if (referenceMatch) {
      return referenceMatch;
    }
  }

  const normalizedIncomingDetails = resolveNormalizedDetails(incoming.details);
  const normalizedIncomingCounterparty = resolveNormalizedDetails(incoming.counterparty);

  const exactMatch = candidates.find((row) => {
    return (
      resolveNormalizedDetails(row.details) === normalizedIncomingDetails &&
      resolveNormalizedDetails(row.counterparty) === normalizedIncomingCounterparty
    );
  });
  if (exactMatch) return exactMatch;

  const detailsMatch = candidates.find(
    (row) => resolveNormalizedDetails(row.details) === normalizedIncomingDetails,
  );
  if (detailsMatch) return detailsMatch;

  const counterpartyMatch = candidates.find(
    (row) =>
      resolveNormalizedDetails(row.counterparty) === normalizedIncomingCounterparty,
  );
  if (counterpartyMatch) return counterpartyMatch;

  return null;
}
