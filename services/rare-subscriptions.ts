import type { CategoryRecord } from "@/types/categorization";

const GENERIC_COUNTERPARTIES = [
  "paypal",
  "klarna",
  "apple",
  "google",
  "google play",
  "adyen",
  "stripe",
  "mollie",
  "buckaroo",
  "sumup",
];

const EXPLICIT_SUBSCRIPTION_KEYWORDS = [
  "abonnement",
  "subscription",
  "streaming",
  "netflix",
  "spotify",
  "disney",
  "viaplay",
  "hbo",
  "youtube premium",
  "google one",
  "icloud",
  "adobe",
  "microsoft 365",
  "playstation plus",
  "nintendo switch online",
  "domain",
  "domein",
  "hosting",
  "vpn",
  "antivirus",
  "lidmaatschap",
];

const SEMIANNUAL_AVG_MIN = 150;
const SEMIANNUAL_AVG_MAX = 210;
const SEMIANNUAL_MIN = 130;
const SEMIANNUAL_MAX = 230;
const YEARLY_AVG_MIN = 320;
const YEARLY_AVG_MAX = 400;
const YEARLY_MIN = 280;
const YEARLY_MAX = 430;
const POSSIBLE_SINGLE_MAX_AGE_DAYS = 400;
const MIN_SINGLE_AMOUNT = 8;

export type RareSubscriptionCadence = "semiannual" | "yearly" | "single";
export type RareSubscriptionEvidence = "confirmed" | "possible";

export type RareSubscriptionTransaction = {
  id: string;
  date: string;
  details: string;
  counterparty: string | null;
  amount: number;
  category_id_auto: string | null;
  category_id_user: string | null;
  analysis_category: string | null;
};

export type RareSubscriptionItem = {
  id: string;
  label: string;
  descriptor: string;
  cadence: RareSubscriptionCadence;
  evidence: RareSubscriptionEvidence;
  frequencyLabel: string;
  lastChargeDate: string;
  previousChargeDate: string | null;
  nextExpectedDate: string | null;
  daysUntilNext: number | null;
  expectedAmount: number;
  annualSpendEstimate: number;
  chargeCount: number;
  latestTransactionId: string;
  latestCounterparty: string | null;
  latestDetails: string;
  latestAmount: number;
  transactionIds: string[];
};

type SubscriptionSignal = "classified" | "keyword";

type Cluster = {
  descriptor: string;
  label: string;
  signal: SubscriptionSignal;
  amountAnchor: number;
  transactions: RareSubscriptionTransaction[];
};

function normalizePattern(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseUtcDate(dateIso: string): Date | null {
  const parsed = new Date(`${String(dateIso || "").slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateIso: string, days: number): string | null {
  const parsed = parseUtcDate(dateIso);
  if (!parsed) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return toIsoDate(parsed);
}

function diffDays(fromIso: string, toIso: string): number | null {
  const from = parseUtcDate(fromIso);
  const to = parseUtcDate(toIso);
  if (!from || !to) return null;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function extractPrimaryDetails(details: string): string {
  return String(details || "").split("|")[0]?.trim() || String(details || "").trim();
}

function normalizedCounterparty(tx: RareSubscriptionTransaction): string {
  return normalizePattern(tx.counterparty || "");
}

function normalizedPrimaryDetails(tx: RareSubscriptionTransaction): string {
  return normalizePattern(extractPrimaryDetails(tx.details));
}

function isGenericCounterparty(value: string): boolean {
  const normalized = normalizePattern(value);
  if (!normalized) return false;
  return GENERIC_COUNTERPARTIES.includes(normalized);
}

function getDisplayLabel(tx: RareSubscriptionTransaction): string {
  const counterparty = String(tx.counterparty || "").trim();
  const detail = extractPrimaryDetails(tx.details);

  if (counterparty && !isGenericCounterparty(counterparty)) {
    return counterparty;
  }
  if (detail) return detail;
  if (counterparty) return counterparty;
  return "Onbekende afschrijving";
}

function getDescriptor(tx: RareSubscriptionTransaction): string {
  const counterparty = normalizedCounterparty(tx);
  const detail = normalizedPrimaryDetails(tx);

  if (counterparty && !isGenericCounterparty(counterparty)) {
    return counterparty;
  }
  return detail || counterparty;
}

function resolveCategoryKey(
  tx: RareSubscriptionTransaction,
  categoryMap: Map<string, CategoryRecord>,
): string {
  const categoryId = tx.category_id_user || tx.category_id_auto;
  if (!categoryId) return "";
  return String(categoryMap.get(categoryId)?.key || "").toLowerCase();
}

function resolveCategoryBudgetGroup(
  tx: RareSubscriptionTransaction,
  categoryMap: Map<string, CategoryRecord>,
) {
  const categoryId = tx.category_id_user || tx.category_id_auto;
  if (!categoryId) return "";
  return String(categoryMap.get(categoryId)?.budget_group || "").toLowerCase();
}

function detectSubscriptionSignal(
  tx: RareSubscriptionTransaction,
  categoryMap: Map<string, CategoryRecord>,
): SubscriptionSignal | null {
  if (tx.analysis_category === "subscriptions") {
    return "classified";
  }

  const categoryBudgetGroup = resolveCategoryBudgetGroup(tx, categoryMap);
  if (categoryBudgetGroup === "subscriptions") {
    return "classified";
  }

  const categoryKey = resolveCategoryKey(tx, categoryMap);
  if (!categoryBudgetGroup && categoryKey.startsWith("subscriptions")) {
    return "classified";
  }

  const haystack = normalizePattern(
    `${tx.counterparty || ""} ${extractPrimaryDetails(tx.details)}`,
  );
  if (
    EXPLICIT_SUBSCRIPTION_KEYWORDS.some((keyword) => haystack.includes(keyword))
  ) {
    return "keyword";
  }

  return null;
}

function amountsAreClose(left: number, right: number): boolean {
  const diff = Math.abs(left - right);
  return diff <= Math.max(5, left * 0.15, right * 0.15);
}

function strongestSignal(
  left: SubscriptionSignal,
  right: SubscriptionSignal,
): SubscriptionSignal {
  if (left === "classified" || right === "classified") return "classified";
  return "keyword";
}

function classifyCadence(
  transactions: RareSubscriptionTransaction[],
): Exclude<RareSubscriptionCadence, "single"> | null {
  if (transactions.length < 2) return null;

  const sorted = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const intervals: number[] = [];

  for (let index = 1; index < sorted.length; index += 1) {
    const days = diffDays(sorted[index - 1]!.date, sorted[index]!.date);
    if (days == null || days <= 0) continue;
    intervals.push(days);
  }

  if (!intervals.length) return null;

  const avg =
    intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const min = Math.min(...intervals);
  const max = Math.max(...intervals);

  if (
    avg >= SEMIANNUAL_AVG_MIN &&
    avg <= SEMIANNUAL_AVG_MAX &&
    min >= SEMIANNUAL_MIN &&
    max <= SEMIANNUAL_MAX
  ) {
    return "semiannual";
  }

  if (
    avg >= YEARLY_AVG_MIN &&
    avg <= YEARLY_AVG_MAX &&
    min >= YEARLY_MIN &&
    max <= YEARLY_MAX
  ) {
    return "yearly";
  }

  return null;
}

function buildFrequencyLabel(
  cadence: RareSubscriptionCadence,
  evidence: RareSubscriptionEvidence,
): string {
  if (cadence === "semiannual") return "2x per jaar";
  if (cadence === "yearly") return "1x per jaar";
  return evidence === "possible" ? "1x gezien" : "eenmalig";
}

function annualSpendEstimate(
  cadence: RareSubscriptionCadence,
  expectedAmount: number,
): number {
  if (cadence === "semiannual") return expectedAmount * 2;
  return expectedAmount;
}

export function detectRareSubscriptionItems(input: {
  transactions: RareSubscriptionTransaction[];
  categories: CategoryRecord[];
  referenceDate: string;
}): RareSubscriptionItem[] {
  const categoryMap = new Map(
    input.categories.map((category) => [category.id, category]),
  );
  const clustersByDescriptor = new Map<string, Cluster[]>();

  for (const tx of input.transactions) {
    if (!tx.id || !tx.date || tx.amount >= 0) continue;

    const signal = detectSubscriptionSignal(tx, categoryMap);
    if (!signal) continue;

    const descriptor = getDescriptor(tx);
    if (!descriptor) continue;

    const amount = Math.abs(tx.amount);
    const clusters = clustersByDescriptor.get(descriptor) || [];
    const existingCluster = clusters.find((cluster) =>
      amountsAreClose(cluster.amountAnchor, amount),
    );

    if (existingCluster) {
      existingCluster.transactions.push(tx);
      existingCluster.amountAnchor =
        (existingCluster.amountAnchor * (existingCluster.transactions.length - 1) +
          amount) /
        existingCluster.transactions.length;
      existingCluster.signal = strongestSignal(existingCluster.signal, signal);
    } else {
      clusters.push({
        descriptor,
        label: getDisplayLabel(tx),
        signal,
        amountAnchor: amount,
        transactions: [tx],
      });
      clustersByDescriptor.set(descriptor, clusters);
    }
  }

  const items: RareSubscriptionItem[] = [];

  for (const clusters of clustersByDescriptor.values()) {
    for (const cluster of clusters) {
      const sorted = [...cluster.transactions].sort((left, right) =>
        right.date.localeCompare(left.date),
      );
      const latest = sorted[0];
      if (!latest) continue;

      const cadence = classifyCadence(cluster.transactions);
      const possibleSingleAge = diffDays(latest.date, input.referenceDate);
      const canBeSingle =
        cluster.transactions.length === 1 &&
        cluster.signal === "classified" &&
        Math.abs(latest.amount) >= MIN_SINGLE_AMOUNT &&
        possibleSingleAge != null &&
        possibleSingleAge >= 0 &&
        possibleSingleAge <= POSSIBLE_SINGLE_MAX_AGE_DAYS;

      if (!cadence && !canBeSingle) continue;

      const resolvedCadence: RareSubscriptionCadence = cadence || "single";
      const evidence: RareSubscriptionEvidence = cadence
        ? "confirmed"
        : "possible";
      const expectedAmount =
        sorted.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / sorted.length;
      const nextExpectedDate =
        resolvedCadence === "semiannual"
          ? addDays(latest.date, 182)
          : resolvedCadence === "yearly"
            ? addDays(latest.date, 365)
            : null;
      const daysUntilNext =
        nextExpectedDate == null
          ? null
          : diffDays(input.referenceDate, nextExpectedDate);

      items.push({
        id: `${cluster.descriptor}:${Math.round(cluster.amountAnchor * 100)}`,
        label: cluster.label,
        descriptor: cluster.descriptor,
        cadence: resolvedCadence,
        evidence,
        frequencyLabel: buildFrequencyLabel(resolvedCadence, evidence),
        lastChargeDate: latest.date,
        previousChargeDate: sorted[1]?.date || null,
        nextExpectedDate,
        daysUntilNext,
        expectedAmount,
        annualSpendEstimate: annualSpendEstimate(resolvedCadence, expectedAmount),
        chargeCount: sorted.length,
        latestTransactionId: latest.id,
        latestCounterparty: latest.counterparty,
        latestDetails: latest.details,
        latestAmount: latest.amount,
        transactionIds: sorted.map((tx) => tx.id),
      });
    }
  }

  return items.sort((left, right) => {
    const leftUpcoming =
      left.daysUntilNext != null &&
      left.daysUntilNext >= -45 &&
      left.daysUntilNext <= 120;
    const rightUpcoming =
      right.daysUntilNext != null &&
      right.daysUntilNext >= -45 &&
      right.daysUntilNext <= 120;

    if (leftUpcoming !== rightUpcoming) {
      return leftUpcoming ? -1 : 1;
    }

    if (left.daysUntilNext != null && right.daysUntilNext != null) {
      if (left.daysUntilNext !== right.daysUntilNext) {
        return left.daysUntilNext - right.daysUntilNext;
      }
    } else if (left.daysUntilNext != null || right.daysUntilNext != null) {
      return left.daysUntilNext != null ? -1 : 1;
    }

    if (left.evidence !== right.evidence) {
      return left.evidence === "confirmed" ? -1 : 1;
    }

    if (left.annualSpendEstimate !== right.annualSpendEstimate) {
      return right.annualSpendEstimate - left.annualSpendEstimate;
    }

    return right.lastChargeDate.localeCompare(left.lastChargeDate);
  });
}
