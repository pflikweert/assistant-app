import { describe, expect, it } from "vitest";

import { buildForecastMonthMath } from "./forecast-month-math";

describe("buildForecastMonthMath", () => {
  it("splits current month totals into booked and remaining values", () => {
    const result = buildForecastMonthMath({
      startingBalance: 2000,
      currentBalanceAnchor: 1300,
      bookedIncomeTotal: 1200,
      bookedForecastEligibleIncomeTotal: 1200,
      bookedExpenseTotal: 900,
      bookedSavingsOutflowTotal: 100,
      bookedFixedCosts: 600,
      bookedSubscriptions: 100,
      bookedVariableCosts: 200,
      expectedIncomeBaseline: 2500,
      remainingCommittedIncomeTotal: 1100,
      expectedFixedCostsBaseline: 800,
      expectedSubscriptionsBaseline: 130,
      expectedVariableCostsBaseline: 350,
      projectedVariableCostsTotal: null,
      expectedSavingsOutflowBaseline: 180,
      remainingCommittedFixedCosts: 200,
      remainingCommittedSubscriptions: 30,
      remainingCommittedSavingsOutflowTotal: 80,
    });

    expect(result.expectedIncomeTotal).toBe(2500);
    expect(result.expectedExpenseTotal).toBe(1280);
    expect(result.expectedSavingsOutflowTotal).toBe(180);
    expect(result.remainingExpectedIncomeTotal).toBe(1300);
    expect(result.remainingExpectedExpenseTotal).toBe(380);
    expect(result.remainingExpectedSavingsOutflowTotal).toBe(80);
    expect(result.expectedCashOutTotal).toBe(1460);
    expect(result.expectedEndOfMonthBalance).toBe(3040);
  });

  it("keeps savings outflow separate from normal expenses", () => {
    const result = buildForecastMonthMath({
      startingBalance: 1000,
      currentBalanceAnchor: 1000,
      bookedIncomeTotal: 0,
      bookedForecastEligibleIncomeTotal: 0,
      bookedExpenseTotal: 0,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 0,
      bookedSubscriptions: 0,
      bookedVariableCosts: 0,
      expectedIncomeBaseline: 0,
      remainingCommittedIncomeTotal: 0,
      expectedFixedCostsBaseline: 400,
      expectedSubscriptionsBaseline: 30,
      expectedVariableCostsBaseline: 220,
      projectedVariableCostsTotal: null,
      expectedSavingsOutflowBaseline: 150,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 150,
    });

    expect(result.expectedExpenseTotal).toBe(650);
    expect(result.expectedSavingsOutflowTotal).toBe(150);
    expect(result.expectedCashOutTotal).toBe(800);
  });

  it("uses the current balance anchor when the month start balance is unknown", () => {
    const result = buildForecastMonthMath({
      startingBalance: null,
      currentBalanceAnchor: 420,
      bookedIncomeTotal: 600,
      bookedForecastEligibleIncomeTotal: 600,
      bookedExpenseTotal: 500,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 300,
      bookedSubscriptions: 100,
      bookedVariableCosts: 100,
      expectedIncomeBaseline: 1200,
      remainingCommittedIncomeTotal: 600,
      expectedFixedCostsBaseline: 600,
      expectedSubscriptionsBaseline: 100,
      expectedVariableCostsBaseline: 180,
      projectedVariableCostsTotal: null,
      expectedSavingsOutflowBaseline: 75,
      remainingCommittedFixedCosts: 300,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 75,
    });

    expect(result.remainingExpectedIncomeTotal).toBe(600);
    expect(result.remainingExpectedExpenseTotal).toBe(380);
    expect(result.remainingExpectedSavingsOutflowTotal).toBe(75);
    expect(result.expectedEndOfMonthBalance).toBe(565);
  });

  it("does not let expected totals drop below already booked spend", () => {
    const result = buildForecastMonthMath({
      startingBalance: 300,
      currentBalanceAnchor: 300,
      bookedIncomeTotal: 0,
      bookedForecastEligibleIncomeTotal: 0,
      bookedExpenseTotal: 280,
      bookedSavingsOutflowTotal: 40,
      bookedFixedCosts: 0,
      bookedSubscriptions: 0,
      bookedVariableCosts: 280,
      expectedIncomeBaseline: 0,
      remainingCommittedIncomeTotal: 0,
      expectedFixedCostsBaseline: 0,
      expectedSubscriptionsBaseline: 0,
      expectedVariableCostsBaseline: 150,
      projectedVariableCostsTotal: null,
      expectedSavingsOutflowBaseline: 20,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.expectedExpenseTotal).toBe(280);
    expect(result.expectedSavingsOutflowTotal).toBe(40);
    expect(result.remainingExpectedExpenseTotal).toBe(0);
    expect(result.remainingExpectedSavingsOutflowTotal).toBe(0);
    expect(result.expectedEndOfMonthBalance).toBe(-20);
    expect(result.riskFlag).toBe("deficit_warning");
  });

  it("uses projected variable costs when current-month actual plus remaining budget exceeds baseline", () => {
    const result = buildForecastMonthMath({
      startingBalance: 300,
      currentBalanceAnchor: 300,
      bookedIncomeTotal: 0,
      bookedForecastEligibleIncomeTotal: 0,
      bookedExpenseTotal: 280,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 0,
      bookedSubscriptions: 0,
      bookedVariableCosts: 280,
      expectedIncomeBaseline: 0,
      remainingCommittedIncomeTotal: 0,
      expectedFixedCostsBaseline: 0,
      expectedSubscriptionsBaseline: 0,
      expectedVariableCostsBaseline: 150,
      projectedVariableCostsTotal: 420,
      expectedSavingsOutflowBaseline: 0,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.expectedVariableCosts).toBe(420);
    expect(result.remainingExpectedExpenseTotal).toBe(140);
  });

  it("reconstructs the maart reference case to 1803.31 without double-counting variable spend", () => {
    const result = buildForecastMonthMath({
      startingBalance: 2748.36,
      currentBalanceAnchor: 2748.36,
      bookedIncomeTotal: 0,
      bookedForecastEligibleIncomeTotal: 0,
      bookedExpenseTotal: 945.38,
      bookedSavingsOutflowTotal: 0,
      bookedFixedCosts: 731.38,
      bookedSubscriptions: 0,
      bookedVariableCosts: 214,
      expectedIncomeBaseline: 0.33,
      remainingCommittedIncomeTotal: 0.33,
      expectedFixedCostsBaseline: 731.38,
      expectedSubscriptionsBaseline: 0,
      expectedVariableCostsBaseline: 214,
      projectedVariableCostsTotal: null,
      expectedSavingsOutflowBaseline: 0,
      remainingCommittedFixedCosts: 0,
      remainingCommittedSubscriptions: 0,
      remainingCommittedSavingsOutflowTotal: 0,
    });

    expect(result.expectedIncomeTotal).toBe(0.33);
    expect(result.expectedExpenseTotal).toBe(945.38);
    expect(result.expectedEndOfMonthBalance).toBe(1803.31);
  });
});
