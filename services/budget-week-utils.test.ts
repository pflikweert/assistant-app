import { describe, expect, it } from "vitest";
import {
    buildCalendarWeekRangesForMonth,
    rebalanceWeeklyBudgets,
    resolveBaseWeeklyBudgetsByDailyMonthRates,
} from "./budget-week-utils";

function utcDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("buildCalendarWeekRangesForMonth", () => {
  it("builds 6 full calendar weeks for March 2026 (month starts on Sunday)", () => {
    const monthStart = utcDate("2026-03-01");
    const monthEndExclusive = utcDate("2026-04-01");

    const ranges = buildCalendarWeekRangesForMonth(
      monthStart,
      monthEndExclusive,
    );

    expect(ranges).toHaveLength(6);
    expect(ranges.every((range) => range.start.getUTCDay() === 1)).toBe(true);
    expect(ranges.every((range) => range.endExclusive.getUTCDay() === 1)).toBe(
      true,
    );
    expect(
      ranges.every(
        (range) =>
          (range.endExclusive.getTime() - range.start.getTime()) / 86400000 ===
          7,
      ),
    ).toBe(true);

    expect(ranges[0].start.toISOString().slice(0, 10)).toBe("2026-02-23");
    expect(ranges[0].endExclusive.toISOString().slice(0, 10)).toBe(
      "2026-03-02",
    );
    expect(ranges[0].daysInPreviousMonth).toBe(6);
    expect(ranges[0].daysInCurrentMonth).toBe(1);

    const last = ranges[ranges.length - 1];
    expect(last.start.toISOString().slice(0, 10)).toBe("2026-03-30");
    expect(last.endExclusive.toISOString().slice(0, 10)).toBe("2026-04-06");
    expect(last.daysInCurrentMonth).toBe(2);
    expect(last.daysInNextMonth).toBe(5);
  });

  it("keeps Monday-start month aligned without previous-month overlap in week 1", () => {
    const monthStart = utcDate("2026-06-01");
    const monthEndExclusive = utcDate("2026-07-01");

    const ranges = buildCalendarWeekRangesForMonth(
      monthStart,
      monthEndExclusive,
    );

    expect(ranges[0].start.toISOString().slice(0, 10)).toBe("2026-06-01");
    expect(ranges[0].daysInPreviousMonth).toBe(0);
    expect(ranges[0].daysInCurrentMonth).toBe(7);
    expect(ranges[ranges.length - 1].daysInNextMonth).toBeGreaterThan(0);
  });

  it("includes overlap on both sides for month ending on Saturday", () => {
    const monthStart = utcDate("2026-01-01");
    const monthEndExclusive = utcDate("2026-02-01");

    const ranges = buildCalendarWeekRangesForMonth(
      monthStart,
      monthEndExclusive,
    );

    expect(ranges[0].daysInPreviousMonth).toBeGreaterThan(0);
    expect(ranges[ranges.length - 1].daysInNextMonth).toBeGreaterThan(0);
  });
});

describe("resolveBaseWeeklyBudgetsByDailyMonthRates", () => {
  it("weights overlap weeks with previous/current/next month daily rates", () => {
    const monthStart = utcDate("2026-03-01");
    const monthEndExclusive = utcDate("2026-04-01");
    const ranges = buildCalendarWeekRangesForMonth(
      monthStart,
      monthEndExclusive,
    );

    const monthlyBudgetMap = new Map<string, number>([
      ["2026-02-01", 900],
      ["2026-03-01", 1200],
      ["2026-04-01", 1500],
    ]);

    const baseBudgets = resolveBaseWeeklyBudgetsByDailyMonthRates(
      ranges,
      monthlyBudgetMap,
      monthStart,
    );

    expect(baseBudgets).toHaveLength(6);
    expect(baseBudgets[0]).toBe(232);
    expect(baseBudgets[5]).toBe(327);

    const total = baseBudgets.reduce((sum, value) => sum + value, 0);
    expect(total).toBe(1643);
  });
});

describe("rebalanceWeeklyBudgets", () => {
  it("keeps original base budgets when there is no spending", () => {
    const baseBudgets = [232, 271, 271, 271, 271, 327];
    const actuals = [0, 0, 0, 0, 0, 0];

    const result = rebalanceWeeklyBudgets(baseBudgets, actuals);

    expect(result.budgets).toEqual(baseBudgets);
    expect(result.finalPool).toBe(0);
  });

  it("reduces future budgets after an early overspend", () => {
    const baseBudgets = [232, 271, 271, 271, 271, 327];
    const actuals = [700, 200, 0, 0, 0, 0];

    const result = rebalanceWeeklyBudgets(baseBudgets, actuals);

    expect(result.budgets[0]).toBe(baseBudgets[0]);
    expect(result.budgets[1]).toBeLessThan(baseBudgets[1]);
    expect(result.budgets[2]).toBeLessThan(baseBudgets[2]);
    expect(result.finalPool).toBe(0);
  });
});
