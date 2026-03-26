import type { CategoryRecord } from "@/types/categorization";
import { hashAccountNumber, normalizeAccountNumber } from "./bank-accounts";

const OWN_ACCOUNT_TRANSFER_HINTS = [
  "eigen rekening",
  "overboeking eigen rekening",
  "naar eigen rekening",
  "tussen eigen rekeningen",
  "interne overboeking",
  "tb eigen rekening",
];
const COUNTERPARTY_ACCOUNT_KEY_HINTS = [
  "tegenrekening",
  "tegenpartij",
  "counterparty",
];

function normalizeText(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hasOwnAccountTransferHint(input: {
  details: string;
  counterparty: string | null;
}) {
  const haystack = normalizeText(`${input.counterparty || ""} ${input.details || ""}`);
  if (!haystack) return false;
  return OWN_ACCOUNT_TRANSFER_HINTS.some((hint) => haystack.includes(hint));
}

export function resolveOwnAccountTransferCategory(
  categoriesByKey: Map<string, CategoryRecord>,
) {
  return (
    categoriesByKey.get("savings_investing_internal_transfer") ||
    categoriesByKey.get("savings_transfer") ||
    null
  );
}

export function extractCounterpartyAccountCandidatesFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
) {
  if (!metadata) return [];

  const values: string[] = [];
  const seen = new Set<string>();

  for (const [rawKey, rawValue] of Object.entries(metadata)) {
    const normalizedKey = normalizeText(rawKey);
    if (
      !COUNTERPARTY_ACCOUNT_KEY_HINTS.some((hint) =>
        normalizedKey.includes(hint),
      )
    ) {
      continue;
    }

    const candidate = String(rawValue || "").trim();
    if (!candidate) continue;

    const normalizedCandidate = normalizeAccountNumber(candidate);
    if (!normalizedCandidate) {
      continue;
    }
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,}$/.test(normalizedCandidate)) {
      continue;
    }
    if (!normalizedCandidate || seen.has(normalizedCandidate)) continue;
    seen.add(normalizedCandidate);
    values.push(normalizedCandidate);
  }

  return values;
}

export type OwnAccountTransferHeuristicMatch = {
  categoryId: string;
  confidence: number;
  model: string;
  reason: string;
};

export async function resolveOwnAccountTransferHeuristicMatch(input: {
  details: string;
  counterparty: string | null;
  metadata?: Record<string, unknown> | null;
  categoriesByKey: Map<string, CategoryRecord>;
  ownAccountHashes?: ReadonlySet<string> | null;
}): Promise<OwnAccountTransferHeuristicMatch | null> {
  const category = resolveOwnAccountTransferCategory(input.categoriesByKey);
  if (!category) return null;

  if (
    hasOwnAccountTransferHint({
      details: input.details,
      counterparty: input.counterparty,
    })
  ) {
    return {
      categoryId: category.id,
      confidence: 0.98,
      model: "heuristic-own-account-transfer-text-v1",
      reason: "Eigen rekening overboeking in details/counterparty",
    };
  }

  const ownHashes = input.ownAccountHashes;
  if (!ownHashes || ownHashes.size === 0) return null;

  const metadataCandidates = extractCounterpartyAccountCandidatesFromMetadata(
    input.metadata || null,
  );
  for (const candidate of metadataCandidates) {
    const candidateHash = await hashAccountNumber(candidate);
    if (ownHashes.has(candidateHash) || ownHashes.has(candidate)) {
      return {
        categoryId: category.id,
        confidence: 0.98,
        model: "heuristic-own-account-transfer-metadata-v1",
        reason: "Tegenrekening hoort bij eigen bankrekening",
      };
    }
  }

  return null;
}
