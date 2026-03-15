import { describe, expect, it } from "vitest";

import type { BudgetPlanComputation } from "../types/categorization";
import {
  getBudgetRiskLabel,
  getBudgetRiskProgress,
  getBudgetRiskTone,
  getMonthBudgetRiskLabel,
  getMonthBudgetRiskProgress,
  getMonthBudgetRiskTone,
} from "./budget-risk";

function createBudgetPlanStub(params: {
  variableBudget: number;
  variableSpent: number;
  monthProgress: number;
}) {
  return {
    flowSummary: {
      variableBudget: params.variableBudget,
    },
    monthToDateExpenses: {
      variableCosts: params.variableSpent,
    },
    monthProgress: params.monthProgress,
  } as BudgetPlanComputation;
}

describe("getBudgetRiskTone", () => {
  it("returns neutral when utilization is missing", () => {
    expect(getBudgetRiskTone(null)).toBe("neutral");
    expect(getBudgetRiskTone(Number.NaN)).toBe("neutral");
  });

  it("maps utilization thresholds to the shared risk tones", () => {
    expect(getBudgetRiskTone(0.79)).toBe("good");
    expect(getBudgetRiskTone(0.8)).toBe("watch");
    expect(getBudgetRiskTone(0.99)).toBe("watch");
    expect(getBudgetRiskTone(1)).toBe("critical");
  });

  it("keeps the public labels aligned with the tones", () => {
    expect(getBudgetRiskLabel(0.4)).toBe("Op schema");
    expect(getBudgetRiskLabel(0.9)).toBe("Let op");
    expect(getBudgetRiskLabel(1.2)).toBe("Boven tempo");
    expect(getBudgetRiskLabel(null)).toBe("Nog geen data");
  });

  it("clamps progress between zero and one", () => {
    expect(getBudgetRiskProgress(null)).toBe(0);
    expect(getBudgetRiskProgress(-0.2)).toBe(0);
    expect(getBudgetRiskProgress(0.35)).toBe(0.35);
    expect(getBudgetRiskProgress(1.25)).toBe(1);
  });
});

describe("getMonthBudgetRiskTone", () => {
  it("returns neutral when there is no usable variable budget", () => {
    expect(getMonthBudgetRiskTone(null)).toBe("neutral");
    expect(
      getMonthBudgetRiskTone(
        createBudgetPlanStub({
          variableBudget: 0,
          variableSpent: 40,
          monthProgress: 0.5,
        }),
      ),
    ).toBe("neutral");
  });

  it("returns good when variable spending stays close to month pace", () => {
    const plan = createBudgetPlanStub({
      variableBudget: 1000,
      variableSpent: 430,
      monthProgress: 0.4,
    });

    expect(getMonthBudgetRiskTone(plan)).toBe("good");
    expect(getMonthBudgetRiskLabel(plan)).toBe("Op schema");
  });

  it("returns watch when spending runs moderately ahead of pace", () => {
    const plan = createBudgetPlanStub({
      variableBudget: 1000,
      variableSpent: 530,
      monthProgress: 0.4,
    });

    expect(getMonthBudgetRiskTone(plan)).toBe("watch");
    expect(getMonthBudgetRiskLabel(plan)).toBe("Let op");
  });

  it("returns critical when spending is clearly ahead of pace or over budget", () => {
    const aheadOfPace = createBudgetPlanStub({
      variableBudget: 1000,
      variableSpent: 620,
      monthProgress: 0.4,
    });
    const overBudget = createBudgetPlanStub({
      variableBudget: 1000,
      variableSpent: 1040,
      monthProgress: 0.8,
    });

    expect(getMonthBudgetRiskTone(aheadOfPace)).toBe("critical");
    expect(getMonthBudgetRiskTone(overBudget)).toBe("critical");
    expect(getMonthBudgetRiskLabel(overBudget)).toBe("Boven tempo");
  });

  it("uses the same clamped progress for month bars", () => {
    const plan = createBudgetPlanStub({
      variableBudget: 1000,
      variableSpent: 1125,
      monthProgress: 0.9,
    });

    expect(getMonthBudgetRiskProgress(plan)).toBe(1);
  });
});
