import type { ForecastSurfaceConfidence, ProvenanceLevel } from "@/services/confidence-model";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import type { ReserveSurfaceBreakdown } from "@/services/reserve-surface";

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export type ExplainabilityItem = {
  key:
    | "expected_end"
    | "reserved"
    | "free_to_spend"
    | "annual_obligations";
  label: string;
  message: string;
  provenance: ProvenanceLevel;
};

export type ForecastSurfaceExplainability = {
  budgetHint: string | null;
  insightsBullets: string[];
  items: ExplainabilityItem[];
};

function formatAmount(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return euro.format(Number(value));
}

export function buildForecastSurfaceExplainability(input: {
  balances: FinancialSurfaceBalanceSnapshot;
  reserveBreakdown: ReserveSurfaceBreakdown | null;
  confidence: ForecastSurfaceConfidence;
}): ForecastSurfaceExplainability {
  const { balances, reserveBreakdown, confidence } = input;
  const currentOperational = balances.currentOperationalBalance.amount;
  const expectedEnd = balances.expectedEndOperationalBalance.amount;
  const freeToSpendNow = balances.freeToSpendNow.amount;
  const currentReserved = balances.currentReservedBalance.amount;
  const protectedReserve = reserveBreakdown?.reservedProtectedInOperationalNow ?? null;
  const annualMonthly = reserveBreakdown?.annualObligationMonthlyTotal ?? null;
  const savingsTargetMonthly = reserveBreakdown?.savingsTargetMonthly ?? null;
  const remainingNet =
    currentOperational != null && expectedEnd != null
      ? Number((expectedEnd - currentOperational).toFixed(2))
      : null;

  const expectedEndMessage =
    expectedEnd == null
      ? "Het verwachte eindsaldo is nog indicatief omdat er te weinig maanddata beschikbaar is."
      : currentOperational != null && remainingNet != null
        ? `Verwacht eindsaldo combineert huidig saldo ${formatAmount(currentOperational)} met resterende maandmutatie ${formatAmount(remainingNet)}.`
        : `Verwacht eindsaldo volgt uit bekende inkomsten, vaste lasten en verwachte variabele uitgaven.`;

  const reservedMessage =
    currentReserved == null
      ? "Gereserveerd geld is nog niet volledig beschikbaar in je instellingen."
      : reserveBreakdown?.source === "modeled"
        ? `Gereserveerd totaal ${formatAmount(currentReserved)} bestaat uit je buffer en geld dat apart staat.`
        : `Gereserveerd geld is voorlopig indicatief.`;

  const freeToSpendMessage =
    freeToSpendNow == null
      ? "Vrij besteedbaar blijft indicatief zolang operationele reservering niet volledig bekend is."
      : protectedReserve != null
        ? `Vrij besteedbaar is ${formatAmount(freeToSpendNow)} na je gereserveerde buffer van ${formatAmount(protectedReserve)}.`
        : `Vrij besteedbaar volgt uit je operationele saldo met de bekende reserveringen.`;

  const annualMessage =
    annualMonthly != null && annualMonthly > 0
      ? `Voor jaarlijkse lasten staat ${formatAmount(annualMonthly)} per maand opzij.`
      : savingsTargetMonthly != null && savingsTargetMonthly > 0
        ? `Je maandbuffer van ${formatAmount(savingsTargetMonthly)} is als reservering meegenomen.`
        : "Er zijn nog geen actieve jaarlijkse lastenregels.";

  const items: ExplainabilityItem[] = [
    {
      key: "expected_end",
      label: "Verwacht eindsaldo",
      message: expectedEndMessage,
      provenance: confidence.expectedEndOperationalBalance.provenance,
    },
    {
      key: "reserved",
      label: "Gereserveerd",
      message: reservedMessage,
      provenance: confidence.currentReservedBalance.provenance,
    },
    {
      key: "free_to_spend",
      label: "Vrij besteedbaar",
      message: freeToSpendMessage,
      provenance: confidence.freeToSpendNow.provenance,
    },
    {
      key: "annual_obligations",
      label: "Jaarlijkse lasten",
      message: annualMessage,
      provenance: confidence.annualObligationReserveRules.provenance,
    },
  ];

  return {
    budgetHint:
      confidence.currentReservedBalance.level === "low"
        ? "Reserveringen zijn nog indicatief; budgetruimte blijft leidend."
        : annualMessage,
    insightsBullets: [
      expectedEndMessage,
      freeToSpendMessage,
      annualMessage,
    ],
    items,
  };
}
