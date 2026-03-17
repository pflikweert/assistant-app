function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonthExclusive(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

function monthsDiff(from: Date, to: Date) {
  return (
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())
  );
}

function resolveForecastReferenceDate(monthStart: Date, now: Date) {
  const currentMonthStart = startOfMonth(now);
  const monthDiff = monthsDiff(currentMonthStart, monthStart);

  if (monthDiff < 0) {
    return addDays(endOfMonthExclusive(monthStart), -1);
  }
  if (monthDiff === 0) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
  }
  return addDays(monthStart, -1);
}

export type BudgetPlanRequestDescriptor = {
  monthStartIso: string;
  planReference: Date;
};

export function createBudgetPlanRequestDescriptors(
  requestedMonths: Date[],
  now: Date,
) {
  const currentMonthStart = startOfMonth(now);

  return requestedMonths.map((monthStart) => {
    const monthDiff = monthsDiff(currentMonthStart, monthStart);
    const planReference =
      monthDiff < 0
        ? resolveForecastReferenceDate(monthStart, now)
        : monthDiff === 0
          ? now
          : monthStart;

    return {
      monthStartIso: dateToIso(monthStart),
      planReference,
    } satisfies BudgetPlanRequestDescriptor;
  });
}
