import type {
  ForecastCarryover,
  ForecastEvent,
  ForecastLayerBalanceSnapshot,
  ForecastMonthState,
} from "@/services/forecast-domain";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function getProjectedForecastEvents(input: ForecastMonthEventMathInput) {
  const sortedEvents = [...input.events].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    if (left.type !== right.type) return left.type.localeCompare(right.type);
    if (left.amount !== right.amount) return left.amount - right.amount;
    return left.label.localeCompare(right.label, "nl");
  });

  if (input.opening.referenceDate == null) return sortedEvents;
  return sortedEvents.filter((event) => event.date > input.opening.referenceDate);
}

function resolveProjectedForecastTotals(events: ForecastEvent[]) {
  return {
    expectedIncome: round2(
      sum(events.filter((event) => event.type === "income").map((event) => Math.abs(event.amount))),
    ),
    expectedExpenses: round2(
      sum(events.filter((event) => event.type === "expense").map((event) => Math.abs(event.amount))),
    ),
    expectedInternalTransfers: round2(
      sum(events.filter((event) => event.type === "internal_transfer").map((event) => Math.abs(event.amount))),
    ),
    expectedReserveAllocations: round2(
      sum(
        events
          .filter((event) => event.type === "reserve_allocation")
          .map((event) => Math.abs(event.amount)),
      ),
    ),
  };
}

export type ForecastMonthMathInput = {
  startingBalance: number | null;
  currentBalanceAnchor: number | null;
  bookedIncomeTotal: number;
  bookedForecastEligibleIncomeTotal: number;
  bookedExpenseTotal: number;
  bookedSavingsOutflowTotal: number;
  bookedFixedCosts: number;
  bookedSubscriptions: number;
  bookedVariableCosts: number;
  expectedIncomeBaseline: number;
  remainingCommittedIncomeTotal: number;
  expectedFixedCostsBaseline: number;
  expectedSubscriptionsBaseline: number;
  expectedVariableCostsBaseline: number;
  projectedVariableCostsTotal?: number | null;
  expectedSavingsOutflowBaseline: number;
  remainingCommittedFixedCosts: number;
  remainingCommittedSubscriptions: number;
  remainingCommittedSavingsOutflowTotal: number;
};

export type ForecastMonthMathResult = {
  expectedIncomeTotal: number;
  expectedExpenseTotal: number;
  expectedSavingsOutflowTotal: number;
  expectedCashOutTotal: number;
  expectedFixedCosts: number;
  expectedSubscriptions: number;
  expectedVariableCosts: number;
  remainingExpectedIncomeTotal: number;
  remainingExpectedExpenseTotal: number;
  remainingExpectedSavingsOutflowTotal: number;
  expectedEndOfMonthBalance: number | null;
  riskFlag: "none" | "deficit_warning";
};

export type ForecastMonthOpeningState = {
  monthStart: string;
  referenceDate: string | null;
  currentBalanceDate: string | null;
  openingOperationalBalance: number | null;
  openingReservedBalance: number | null;
  openingNetWorth: number | null;
  carryover: ForecastCarryover | null;
};

export type ForecastMonthEventMathInput = {
  opening: ForecastMonthOpeningState;
  events: ForecastEvent[];
  freeToSpendCarryover?: number | null;
};

function resolveOpeningBalance(
  value: number | null | undefined,
  fallback: number | null,
) {
  return value == null ? fallback : round2(value);
}

function applyTransferImpact(
  opening: ForecastLayerBalanceSnapshot,
  event: ForecastEvent,
) {
  const currentOperational = opening.operational == null ? null : round2(opening.operational);
  const currentReserved = opening.reserved == null ? null : round2(opening.reserved);
  const currentNetWorth = opening.netWorth == null ? null : round2(opening.netWorth);

  if (currentOperational == null || currentReserved == null || currentNetWorth == null) {
    return opening;
  }

  const amount = round2(Math.abs(event.amount));

  if (event.type === "reserve_allocation") {
    return {
      operational: round2(currentOperational - amount),
      reserved: round2(currentReserved + amount),
      netWorth: currentNetWorth,
    };
  }

  if (event.type === "internal_transfer") {
    return opening;
  }

  if (event.type === "correction") {
    // Tijdelijke balanscorrectie: dit is geen echte geldstroom en mag de
    // maanduitkomst niet als extra inkomen of uitgave vervormen.
    return opening;
  }

  return opening;
}

function applyEventImpact(
  opening: ForecastLayerBalanceSnapshot,
  event: ForecastEvent,
) {
  const amount = round2(Math.abs(event.amount));
  const op = opening.operational == null ? null : round2(opening.operational);
  const reserved = opening.reserved == null ? null : round2(opening.reserved);
  const netWorth = opening.netWorth == null ? null : round2(opening.netWorth);

  if (op == null || reserved == null || netWorth == null) {
    return opening;
  }

  if (event.type === "income") {
    return {
      operational: round2(op + amount),
      reserved,
      netWorth: round2(netWorth + amount),
    };
  }

  if (event.type === "expense") {
    return {
      operational: round2(op - amount),
      reserved,
      netWorth: round2(netWorth - amount),
    };
  }

  return applyTransferImpact(opening, event);
}

function resolveMonthStateStatus(params: {
  riskFlag: "none" | "deficit_warning";
  cashRiskFlag: "none" | "cash_gap_warning";
  hasForecastEvents: boolean;
  openingKnown: boolean;
}): "unknown" | "observed" | "projected" | "settled" | "stressed" {
  if (params.riskFlag === "deficit_warning") return "stressed";
  if (params.hasForecastEvents) return "projected";
  if (params.openingKnown) return "observed";
  return "unknown";
}

export function buildForecastMonthStateFromEvents(
  input: ForecastMonthEventMathInput,
): ForecastMonthState {
  const openingOperationalBalance = resolveOpeningBalance(
    input.opening.openingOperationalBalance,
    input.opening.openingOperationalBalance ?? input.opening.openingNetWorth ?? 0,
  );
  const openingReservedBalance = resolveOpeningBalance(
    input.opening.openingReservedBalance,
    0,
  );
  const openingNetWorth = resolveOpeningBalance(
    input.opening.openingNetWorth,
    openingOperationalBalance != null
      ? round2(openingOperationalBalance + openingReservedBalance)
      : null,
  );

  const opening: ForecastLayerBalanceSnapshot = {
    operational: openingOperationalBalance,
    reserved: openingReservedBalance,
    netWorth: openingNetWorth,
  };

  let running = opening;
  let lowestExpectedBalance = running.operational;
  let lowestExpectedBalanceDate = running.operational == null ? null : input.opening.currentBalanceDate;

  const projectedEvents = getProjectedForecastEvents(input);

  for (const event of projectedEvents) {
    running = applyEventImpact(running, event);
    if (running.operational == null) continue;
    if (lowestExpectedBalance == null || running.operational < lowestExpectedBalance) {
      lowestExpectedBalance = running.operational;
      lowestExpectedBalanceDate = event.date;
    }
  }

  const expectedEndOperationalBalance = running.operational;
  const expectedEndReservedBalance = running.reserved;
  const expectedEndNetWorth = running.netWorth;
  const freeToSpendCarryover =
    expectedEndOperationalBalance == null || expectedEndReservedBalance == null
      ? null
      : round2(expectedEndOperationalBalance - expectedEndReservedBalance);

  const projectedTotals = resolveProjectedForecastTotals(projectedEvents);

  const certainty = projectedEvents.reduce<ForecastMonthState["certainty"]>(
    (next, event) => {
      if (event.certainty === "estimated") return "estimated";
      if (event.certainty === "inferred" && next !== "estimated") return "inferred";
      if (event.certainty === "committed" && next === "booked") return "committed";
      if (next == null) return event.certainty;
      return next;
    },
    "booked",
  );

  const riskFlag =
    expectedEndOperationalBalance != null && expectedEndOperationalBalance < 0
      ? "deficit_warning"
      : "none";
  const cashRiskFlag =
    lowestExpectedBalance != null && lowestExpectedBalance < 0
      ? "cash_gap_warning"
      : "none";
  const nextExpectedEvent =
    input.opening.referenceDate == null
      ? projectedEvents[0] || null
      : projectedEvents.find((event) => event.date > input.opening.referenceDate) ||
        projectedEvents[0] ||
        null;

  return {
    monthStart: input.opening.monthStart,
    referenceDate: input.opening.referenceDate,
    currentBalanceDate: input.opening.currentBalanceDate,
    status: resolveMonthStateStatus({
      riskFlag,
      cashRiskFlag,
      hasForecastEvents: projectedEvents.length > 0,
      openingKnown: openingOperationalBalance != null,
    }),
    openingOperationalBalance,
    openingReservedBalance,
    openingNetWorth,
    currentBalance: openingOperationalBalance,
    reservedBalance: openingReservedBalance,
    netWorth: openingNetWorth,
    freeToSpend: input.freeToSpendCarryover ?? freeToSpendCarryover,
    expectedIncome: projectedTotals.expectedIncome,
    expectedExpenses: projectedTotals.expectedExpenses,
    expectedInternalTransfers: projectedTotals.expectedInternalTransfers,
    expectedReserveAllocations: projectedTotals.expectedReserveAllocations,
    expectedEndOperationalBalance,
    expectedEndReservedBalance,
    expectedEndNetWorth,
    freeToSpendCarryover,
    expectedEndBalance: expectedEndOperationalBalance,
    lowestExpectedBalance,
    lowestExpectedBalanceDate,
    nextExpectedEventDate: nextExpectedEvent?.date || null,
    nextExpectedEventLabel: nextExpectedEvent?.label || null,
    expectedIncomeTotal: projectedTotals.expectedIncome,
    remainingExpectedIncomeTotal: null,
    remainingExpectedExpenseTotal: null,
    remainingExpectedSavingsOutflowTotal: null,
    upcomingCommittedIncomeTotal: round2(
      sum(
        projectedEvents
          .filter((event) => event.type === "income")
          .map((event) => Math.abs(event.amount)),
      ),
    ),
    upcomingCommittedExpenseTotal: round2(
      sum(
        projectedEvents
          .filter((event) => event.type === "expense")
          .map((event) => Math.abs(event.amount)),
      ),
    ),
    expectedFixedCosts: null,
    expectedSubscriptions: null,
    expectedVariableCosts: null,
    riskFlag,
    cashRiskFlag,
    certainty,
    carryover: input.opening.carryover,
    events: projectedEvents,
  };
}

export function buildForecastMonthMath(
  input: ForecastMonthMathInput,
): ForecastMonthMathResult {
  const remainingExpectedIncomeTotal = round2(
    Math.max(
      input.remainingCommittedIncomeTotal,
      input.expectedIncomeBaseline - input.bookedForecastEligibleIncomeTotal,
      0,
    ),
  );
  const expectedIncomeTotal = round2(
    input.bookedIncomeTotal + remainingExpectedIncomeTotal,
  );

  const expectedFixedCosts = round2(
    Math.max(
      input.bookedFixedCosts + input.remainingCommittedFixedCosts,
      input.expectedFixedCostsBaseline,
      input.bookedFixedCosts,
    ),
  );
  const expectedSubscriptions = round2(
    Math.max(
      input.bookedSubscriptions + input.remainingCommittedSubscriptions,
      input.expectedSubscriptionsBaseline,
      input.bookedSubscriptions,
    ),
  );
  const expectedVariableCosts = round2(
    Math.max(
      input.projectedVariableCostsTotal ?? 0,
      input.expectedVariableCostsBaseline,
      input.bookedVariableCosts,
      0,
    ),
  );
  const expectedSavingsOutflowTotal = round2(
    Math.max(
      input.bookedSavingsOutflowTotal + input.remainingCommittedSavingsOutflowTotal,
      input.expectedSavingsOutflowBaseline,
      input.bookedSavingsOutflowTotal,
      0,
    ),
  );
  const expectedExpenseTotal = round2(
    expectedFixedCosts + expectedSubscriptions + expectedVariableCosts,
  );
  const expectedCashOutTotal = round2(
    expectedExpenseTotal + expectedSavingsOutflowTotal,
  );

  const remainingExpectedExpenseTotal = round2(
    Math.max(expectedExpenseTotal - input.bookedExpenseTotal, 0),
  );
  const remainingExpectedSavingsOutflowTotal = round2(
    Math.max(expectedSavingsOutflowTotal - input.bookedSavingsOutflowTotal, 0),
  );

  const expectedEndOfMonthBalance =
    input.startingBalance != null
      ? round2(
          input.startingBalance + expectedIncomeTotal - expectedCashOutTotal,
        )
      : input.currentBalanceAnchor != null
        ? round2(
            input.currentBalanceAnchor +
              remainingExpectedIncomeTotal -
              remainingExpectedExpenseTotal -
              remainingExpectedSavingsOutflowTotal,
          )
        : null;

  return {
    expectedIncomeTotal,
    expectedExpenseTotal,
    expectedSavingsOutflowTotal,
    expectedCashOutTotal,
    expectedFixedCosts,
    expectedSubscriptions,
    expectedVariableCosts,
    remainingExpectedIncomeTotal,
    remainingExpectedExpenseTotal,
    remainingExpectedSavingsOutflowTotal,
    expectedEndOfMonthBalance,
    riskFlag:
      expectedEndOfMonthBalance != null && expectedEndOfMonthBalance < 0
        ? "deficit_warning"
        : "none",
  };
}
