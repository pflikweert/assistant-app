import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";
import type { InsightsForecastSummary } from "@/services/insights-month-context";
import type { ReserveSurfaceBreakdown } from "@/services/reserve-surface";
import type { BudgetPlanComputation } from "@/types/categorization";

export type ConfidenceLevel = "high" | "medium" | "low";
export type ConfidenceLabel = "Hoog vertrouwen" | "Redelijk vertrouwen" | "Indicatief";
// Provenance blijft intern voor explainability/guardrails:
// - hard: direct uit expliciete data of bevestigde regels
// - derived: rule-based afleiding uit patronen of combinaties
// - uncertain: bruikbaar als indicatie, maar met beperkte onderbouwing
export type ProvenanceLevel = "hard" | "derived" | "uncertain";

export type ConfidenceSignal = {
  level: ConfidenceLevel;
  label: ConfidenceLabel;
  provenance: ProvenanceLevel;
  reasons: string[];
};

export type ForecastSurfaceConfidence = {
  expectedEndOperationalBalance: ConfidenceSignal;
  lowestOperationalPointInMonth: ConfidenceSignal;
  currentReservedBalance: ConfidenceSignal;
  freeToSpendNow: ConfidenceSignal;
  safeToSpendUntilNextIncome: ConfidenceSignal;
  annualObligationReserveRules: ConfidenceSignal;
  inferredRecurringIncome: ConfidenceSignal;
  inferredVariableSpending: ConfidenceSignal;
};

function confidenceLabel(level: ConfidenceLevel): ConfidenceLabel {
  if (level === "high") return "Hoog vertrouwen";
  if (level === "medium") return "Redelijk vertrouwen";
  return "Indicatief";
}

function signal(
  level: ConfidenceLevel,
  provenance: ProvenanceLevel,
  reasons: string[],
): ConfidenceSignal {
  return {
    level,
    label: confidenceLabel(level),
    provenance,
    reasons,
  };
}

export function buildForecastSurfaceConfidence(input: {
  forecast: InsightsForecastSummary | null;
  plan: BudgetPlanComputation | null;
  balances: FinancialSurfaceBalanceSnapshot;
  reserveBreakdown: ReserveSurfaceBreakdown | null;
}): ForecastSurfaceConfidence {
  const { forecast, plan, balances, reserveBreakdown } = input;
  const hasForecast = Boolean(forecast);
  const hasExpectedEnd = balances.expectedEndOperationalBalance.amount != null;
  const hasCurrentOperational = balances.currentOperationalBalance.amount != null;
  const hasLowestPoint = balances.lowestOperationalPointInMonth.amount != null;
  const hasLowestPointDate = Boolean(forecast?.lowestExpectedBalanceDate);
  const hasRecurringIncome =
    Number(forecast?.upcomingCommittedIncomeTotal || 0) > 0;
  const hasInferredIncome =
    !hasRecurringIncome && Number(forecast?.remainingExpectedIncomeTotal || 0) > 0;
  const variableWeeks = (plan?.weeklyVariablePlan || []).length;
  const hasVariableHistory = variableWeeks >= 3;
  const hasVariableEstimate = forecast?.expectedVariableCosts != null;
  const reserveModeled = reserveBreakdown?.source === "modeled";
  const hasReserveProtected =
    reserveModeled &&
    reserveBreakdown?.reservedProtectedInOperationalNow != null;
  const hasReserveAccounts =
    reserveModeled && reserveBreakdown?.reservedInAccountsNow != null;
  const annualActive = Number(reserveBreakdown?.annualObligationMonthlyTotal || 0) > 0;
  const inferredAnnualCount = reserveBreakdown?.activeInferredAnnualRuleCount ?? 0;
  const manualAnnualCount = reserveBreakdown?.activeManualAnnualRuleCount ?? 0;

  const inferredRecurringIncome = hasRecurringIncome
    ? signal("high", "hard", ["Er zijn bevestigde terugkerende inkomsten."])
    : hasInferredIncome
      ? signal("medium", "derived", ["Inkomen is deels afgeleid uit patroondata."])
      : signal("low", "uncertain", ["Nog weinig duidelijke inkomenssignalen."]);

  const inferredVariableSpending = hasVariableHistory
    ? signal("high", "derived", ["Variabele uitgaven steunen op meerdere weekpatronen."])
    : hasVariableEstimate
      ? signal("medium", "derived", ["Variabele uitgaven zijn indicatief afgeleid."])
      : signal("low", "uncertain", ["Onvoldoende patroondata voor variabele uitgaven."]);

  const annualObligationReserveRules =
    !annualActive
      ? signal("low", "uncertain", ["Nog geen actieve jaarlijkse lastenregels."])
      : inferredAnnualCount > 0 && manualAnnualCount === 0
        ? signal("medium", "derived", [
            "Jaarlijkse lasten zijn actief en grotendeels afgeleid uit historie.",
          ])
        : signal("high", "hard", [
            "Actieve jaarlijkse lastenregels zijn expliciet ingesteld of bevestigd.",
          ]);

  const currentReservedBalance =
    !reserveModeled
      ? signal("low", "uncertain", ["Gereserveerd geld is nog niet volledig gemodelleerd."])
      : hasReserveProtected && hasReserveAccounts
        ? signal("high", "derived", [
            "Gereserveerd geld komt uit rekeningcontext en operationele bescherming.",
          ])
        : signal("medium", "derived", [
            "Gereserveerd geld komt uit een gedeeltelijk gemodelleerde reservecontext.",
          ]);

  const freeToSpendNow =
    !hasCurrentOperational
      ? signal("low", "uncertain", ["Actuele operationele stand ontbreekt nog."])
      : hasReserveProtected
        ? signal("high", "derived", [
            "Vrij besteedbaar is berekend met expliciete operationele reservering.",
          ])
        : reserveModeled
          ? signal("medium", "derived", [
              "Vrij besteedbaar is berekend, maar reserveringsbescherming is beperkt.",
            ])
          : signal("low", "uncertain", [
              "Vrij besteedbaar is indicatief omdat reserveringsdata ontbreekt.",
            ]);

  const expectedEndOperationalBalance =
    !hasForecast || !hasExpectedEnd
      ? signal("low", "uncertain", ["Onvoldoende forecastdata voor een sterke maandverwachting."])
      : inferredRecurringIncome.level === "high" && inferredVariableSpending.level !== "low"
        ? signal("high", "derived", [
            "Maandverwachting steunt op harde inkomsten en stabiele uitgavenpatronen.",
          ])
        : signal("medium", "derived", [
            "Maandverwachting is deels patroon-gedreven en blijft indicatief.",
          ]);
  const safeToSpendUntilNextIncome =
    !hasCurrentOperational
      ? signal("low", "uncertain", [
          "Veilige bestedingsruimte is indicatief zonder actuele operationele stand.",
        ])
      : hasRecurringIncome
        ? signal("high", "derived", [
            "Veilige bestedingsruimte steunt op bekende inkomensmomenten en verwachte lasten.",
          ])
        : signal("medium", "derived", [
            "Veilige bestedingsruimte is afgeleid, maar inkomensmoment blijft deels indicatief.",
          ]);

  const lowestOperationalPointInMonth =
    !hasLowestPoint
      ? signal("low", "uncertain", ["Laagste punt kan nog niet betrouwbaar worden bepaald."])
      : hasLowestPointDate && expectedEndOperationalBalance.level !== "low"
        ? signal("medium", "derived", [
            "Laagste punt volgt uit dezelfde forecastbasis als de maandverwachting.",
          ])
        : signal("low", "uncertain", [
            "Laagste punt is indicatief door beperkte timing- of patroondata.",
          ]);

  return {
    expectedEndOperationalBalance,
    lowestOperationalPointInMonth,
    currentReservedBalance,
    freeToSpendNow,
    safeToSpendUntilNextIncome,
    annualObligationReserveRules,
    inferredRecurringIncome,
    inferredVariableSpending,
  };
}
