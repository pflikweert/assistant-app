import { describe, expect, it } from "vitest";

import type {
  BudgetPlanComputation,
  BudgetWeekPlanRow,
} from "../types/categorization";
import {
  getBudgetRiskLabel,
  getBudgetRiskProgress,
  getBudgetRiskTone,
  getMonthBudgetRiskLabel,
  getMonthBudgetRiskProgress,
  getMonthBudgetRiskTone,
  getMonthVariableBudgetSnapshot,
  getWeekBudgetSnapshot,
  getWeekTempoMessage,
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

function createWeekStub(params: {
  budget: number;
  actual: number;
  remaining: number;
  utilization: number;
  startDate?: string;
  endDateExclusive?: string;
}) {
  return {
    weekNumber: 2,
    label: "Week 2",
    startDate: params.startDate ?? "2026-03-09",
    endDateExclusive: params.endDateExclusive ?? "2026-03-16",
    daysInCurrentMonth: 7,
    daysInPreviousMonth: 0,
    daysInNextMonth: 0,
    crossesMonthBoundary: false,
    budget: params.budget,
    actual: params.actual,
    remaining: params.remaining,
    utilization: params.utilization,
    isCurrentWeek: true,
    isPastWeek: false,
    wasRebalanced: false,
    overrunAmount: params.remaining < 0 ? Math.abs(params.remaining) : 0,
  } as BudgetWeekPlanRow;
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
    const noBudgetPlan = createBudgetPlanStub({
      variableBudget: 0,
      variableSpent: 40,
      monthProgress: 0.5,
    });
    expect(getMonthBudgetRiskTone(noBudgetPlan)).toBe("neutral");
    expect(getMonthVariableBudgetSnapshot(noBudgetPlan).state).toBe("no_budget");
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

  it("returns a reusable month variable budget snapshot", () => {
    const snapshot = getMonthVariableBudgetSnapshot(
      createBudgetPlanStub({
        variableBudget: 1000,
        variableSpent: 430,
        monthProgress: 0.4,
      }),
    );

    expect(snapshot.state).toBe("within_budget");
    expect(snapshot.remaining).toBe(570);
    expect(snapshot.label).toBe("Op schema");
    expect(snapshot.progress).toBe(0.43);
  });
});

describe("week budget snapshots", () => {
  it("builds a reusable snapshot for week cards", () => {
    const snapshot = getWeekBudgetSnapshot(
      createWeekStub({
        budget: 250,
        actual: 120,
        remaining: 130,
        utilization: 0.48,
      }),
      new Date("2026-03-11T12:00:00.000Z"),
    );

    expect(snapshot.state).toBe("within_budget");
    expect(snapshot.label).toBe("Op schema");
    expect(snapshot.progress).toBe(0.48);
    expect(snapshot.elapsedRatio).toBeGreaterThan(0);
    expect(snapshot.expectedSpend).toBeGreaterThan(0);
  });

  it("describes week tempo using the shared message helper", () => {
    const underTempo = getWeekTempoMessage(
      createWeekStub({
        budget: 250,
        actual: 80,
        remaining: 170,
        utilization: 0.32,
      }),
      new Date("2026-03-11T12:00:00.000Z"),
    );
    const overTempo = getWeekTempoMessage(
      createWeekStub({
        budget: 250,
        actual: 170,
        remaining: 80,
        utilization: 0.68,
      }),
      new Date("2026-03-11T12:00:00.000Z"),
    );

    expect(underTempo).toContain("onder je weektempo");
    expect(overTempo).toContain("boven je weektempo");
  });
});
