export type SafeToSpendConfidenceLevel = "high" | "medium" | "low";

export type SafeToSpendExplanationParts = {
  incomeLabel: string | null;
  incomeDate: string | null;
  isEstimatedAnchorDate?: boolean;
  projectedCosts: number;
  projectedIncome: number;
  windowStart: string;
  windowEnd: string | null;
  confidence: SafeToSpendConfidenceLevel;
};

function formatAmount(value: number | null) {
  if (value == null) return "€ 0,00";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

function normalizeIncomeLabel(value: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "inkomen";
  return raw.toLowerCase().includes("salaris") ? "salaris" : raw.toLowerCase();
}

export function buildSafeToSpendExplanation(
  parts: SafeToSpendExplanationParts | null,
): string | null {
  if (!parts?.incomeDate) return null;

  const incomeDateLabel = formatDate(parts.incomeDate);
  const incomeLabel = normalizeIncomeLabel(parts.incomeLabel);
  const anchorPrefix = parts.isEstimatedAnchorDate
    ? `naar verwachting je ${incomeLabel}`
    : `je ${incomeLabel}`;
  const projectedCosts = Math.max(parts.projectedCosts, 0);
  const projectedIncome = Math.max(parts.projectedIncome, 0);

  if (parts.confidence === "low") {
    return `Indicatief: we rekenen tot ${anchorPrefix} op ${incomeDateLabel}, op basis van bekende patronen en verwachte lasten.`;
  }

  if (projectedIncome > 0) {
    return `We rekenen tot ${anchorPrefix} op ${incomeDateLabel}, rekening houdend met ${formatAmount(projectedCosts)} aan verwachte lasten en ${formatAmount(projectedIncome)} aan verwachte inkomsten.`;
  }

  return `We rekenen tot ${anchorPrefix} op ${incomeDateLabel}, rekening houdend met ${formatAmount(projectedCosts)} aan verwachte lasten.`;
}
