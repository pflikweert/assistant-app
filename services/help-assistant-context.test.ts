import { describe, expect, it } from "vitest";

import {
  buildHelpAssistantContext,
  buildSpendingAdviceContext,
} from "./help-assistant-context";

describe("buildSpendingAdviceContext", () => {
  it("maps budget screen signals to normalized spending context", () => {
    const context = buildHelpAssistantContext({
      screenId: "budget",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "budget",
        remainingVariableBudget: 320,
        totalVariableBudget: 1200,
        spentVariableBudget: 880,
        weekRemainingBudget: 70,
        weekTempoDelta: -15,
        upcomingCommittedExpenseTotal: 410,
        expectedFixedCosts: 900,
        expectedSubscriptions: 120,
        forecastExpectedEndBalance: 280,
        forecastLowestExpectedBalance: 90,
        hasForecastData: true,
      },
    });

    const result = buildSpendingAdviceContext({
      context,
      requestedAmount: 40,
    });

    expect(result.periodLabel).toBe("maart 2026");
    expect(result.requestedAmount).toBe(40);
    expect(result.budget.remainingVariableBudget).toBe(320);
    expect(result.planning.upcomingCommittedExpenseTotal).toBe(410);
    expect(result.forecast.expectedEndBalance).toBe(280);
    expect(result.forecast.lowestExpectedBalance).toBe(90);
    expect(result.dataQuality.hasBudgetSignals).toBe(true);
    expect(result.dataQuality.hasPlanningSignals).toBe(true);
    expect(result.dataQuality.hasForecastSignals).toBe(true);
  });

  it("marks expected data gaps on non-budget screens", () => {
    const context = buildHelpAssistantContext({
      screenId: "transactions",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "transactions",
        activeMonthLabel: "maart 2026",
        activeFilterCount: 1,
        hasMonthFilter: true,
        hasSearchQuery: false,
      },
    });

    const result = buildSpendingAdviceContext({ context });

    expect(result.dataQuality.hasBudgetSignals).toBe(false);
    expect(result.dataQuality.dataGaps).toContain(
      "budget_signal_niet_beschikbaar_op_dit_scherm",
    );
    expect(result.dataQuality.dataGaps).not.toContain(
      "variabele_budgetruimte_ontbreekt",
    );
  });

  it("accepts budget-like context on dashboard for spending advice", () => {
    const context = buildHelpAssistantContext({
      screenId: "dashboard",
      selectedPeriod: { label: "maart 2026" },
      screenContext: {
        kind: "budget",
        monthLabel: "maart 2026",
        remainingVariableBudget: 180,
        spentVariableBudget: 420,
        totalVariableBudget: 600,
        expectedFixedCosts: 900,
        expectedSubscriptions: 120,
        hasForecastData: false,
      },
    });

    const result = buildSpendingAdviceContext({ context });

    expect(result.budget.remainingVariableBudget).toBe(180);
    expect(result.planning.expectedFixedCosts).toBe(900);
    expect(result.dataQuality.hasBudgetSignals).toBe(true);
    expect(result.dataQuality.dataGaps).toContain("forecast_signalen_beperkt");
  });
});
