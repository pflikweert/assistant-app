function round2(value: number) {
  return Math.round(value * 100) / 100;
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
