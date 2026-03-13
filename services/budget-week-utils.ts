export type CalendarWeekRange = {
  weekNumber: number;
  label: string;
  start: Date;
  endExclusive: Date;
  daysInCurrentMonth: number;
  daysInPreviousMonth: number;
  daysInNextMonth: number;
  crossesMonthBoundary: boolean;
};

function roundEuro(value: number) {
  return Math.round(value);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthExclusive(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function subtractDays(date: Date, days: number) {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

function daysBetween(startInclusive: Date, endExclusive: Date) {
  const ms = endExclusive.getTime() - startInclusive.getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfUtcWeekMonday(date: Date) {
  const dayStart = startOfUtcDay(date);
  const weekday = dayStart.getUTCDay();
  const offsetFromMonday = weekday === 0 ? 6 : weekday - 1;
  return subtractDays(dayStart, offsetFromMonday);
}

export function buildCalendarWeekRangesForMonth(
  monthStart: Date,
  monthEndExclusive: Date,
): CalendarWeekRange[] {
  const resolveOverlapDayCounts = (rangeStart: Date) => {
    let daysInCurrentMonth = 0;
    let daysInPreviousMonth = 0;
    let daysInNextMonth = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      const day = addDays(rangeStart, dayOffset);
      if (day < monthStart) {
        daysInPreviousMonth += 1;
        continue;
      }
      if (day >= monthEndExclusive) {
        daysInNextMonth += 1;
        continue;
      }
      daysInCurrentMonth += 1;
    }

    return {
      daysInCurrentMonth,
      daysInPreviousMonth,
      daysInNextMonth,
      crossesMonthBoundary: daysInPreviousMonth > 0 || daysInNextMonth > 0,
    };
  };

  const firstWeekStart = startOfUtcWeekMonday(monthStart);
  const lastWeekStart = startOfUtcWeekMonday(subtractDays(monthEndExclusive, 1));
  const weekWindowEndExclusive = addDays(lastWeekStart, 7);

  const ranges: CalendarWeekRange[] = [];
  let cursor = firstWeekStart;
  let weekNumber = 1;

  while (cursor < weekWindowEndExclusive) {
    const endExclusive = addDays(cursor, 7);
    const overlap = resolveOverlapDayCounts(cursor);

    ranges.push({
      weekNumber,
      label: `Week ${weekNumber}`,
      start: cursor,
      endExclusive,
      ...overlap,
    });

    cursor = endExclusive;
    weekNumber += 1;
  }

  return ranges;
}

export function resolveBaseWeeklyBudgetsByDailyMonthRates(
  weekRanges: CalendarWeekRange[],
  variableMonthlyBudgetByMonthStartIso: Map<string, number>,
  currentMonthStart: Date,
): number[] {
  const fallbackMonthBudget = roundEuro(
    Math.max(
      variableMonthlyBudgetByMonthStartIso.get(dateToIso(currentMonthStart)) ||
        0,
      0,
    ),
  );

  const resolveDailyVariableBudget = (day: Date) => {
    const dayMonthStart = startOfMonth(day);
    const monthStartIso = dateToIso(dayMonthStart);
    const monthBudget = roundEuro(
      Math.max(
        variableMonthlyBudgetByMonthStartIso.get(monthStartIso) ??
          fallbackMonthBudget,
        0,
      ),
    );
    const daysInMonth = daysBetween(
      dayMonthStart,
      endOfMonthExclusive(dayMonthStart),
    );
    return daysInMonth > 0 ? monthBudget / daysInMonth : 0;
  };

  return weekRanges.map((range) => {
    let budget = 0;
    for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
      budget += resolveDailyVariableBudget(addDays(range.start, dayOffset));
    }
    return roundEuro(budget);
  });
}

export function rebalanceWeeklyBudgets(
  baseWeeklyBudgets: number[],
  weekActuals: number[],
): {
  budgets: number[];
  finalPool: number;
} {
  let remainingPool = baseWeeklyBudgets.reduce((sum, budget) => sum + budget, 0);
  let remainingWeight = baseWeeklyBudgets.reduce(
    (sum, budget) => sum + Math.max(budget, 0),
    0,
  );

  const budgets: number[] = [];

  for (let index = 0; index < baseWeeklyBudgets.length; index += 1) {
    const weekWeight = Math.max(baseWeeklyBudgets[index], 0);
    const budget =
      remainingWeight <= weekWeight
        ? roundEuro(Math.max(remainingPool, 0))
        : roundEuro(
            Math.max(
              (remainingPool * weekWeight) / Math.max(remainingWeight, 1),
              0,
            ),
          );

    budgets.push(budget);

    const actual = Math.max(weekActuals[index] || 0, 0);
    remainingPool -= Math.max(actual, budget);
    remainingWeight -= weekWeight;
  }

  return {
    budgets,
    finalPool: remainingPool,
  };
}
