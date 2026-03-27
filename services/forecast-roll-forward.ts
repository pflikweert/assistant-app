import {
  buildForecastMonthStateFromEvents,
  type ForecastMonthOpeningState,
} from "@/services/forecast-month-math";
import type { ForecastEvent, ForecastMonthState } from "@/services/forecast-domain";

export type ForecastRollForwardInput = {
  months: Date[];
  referenceDate: Date;
  monthEventsByMonthStart: Map<string, ForecastEvent[]>;
  openingOperationalBalance: number | null;
  openingReservedBalance?: number | null;
  openingNetWorth?: number | null;
};

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function endOfMonthExclusive(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function buildMonthOpeningState(params: {
  monthStart: Date;
  referenceDate: Date;
  openingOperationalBalance: number | null;
  openingReservedBalance: number | null;
  openingNetWorth: number | null;
}): ForecastMonthOpeningState {
  const {
    monthStart,
    referenceDate,
    openingOperationalBalance,
    openingReservedBalance,
    openingNetWorth,
  } = params;
  return {
    monthStart: dateToIso(monthStart),
    referenceDate: dateToIso(referenceDate),
    currentBalanceDate: dateToIso(addMonths(monthStart, -1)),
    openingOperationalBalance,
    openingReservedBalance,
    openingNetWorth,
    carryover: null,
  };
}

function extractNextMonthOpeningState(monthState: ForecastMonthState) {
  return {
    openingOperationalBalance: monthState.expectedEndOperationalBalance,
    openingReservedBalance: monthState.expectedEndReservedBalance,
    openingNetWorth: monthState.expectedEndNetWorth,
  };
}

export function rollForwardForecastMonths(
  input: ForecastRollForwardInput,
): ForecastMonthState[] {
  const states: ForecastMonthState[] = [];
  let openingOperationalBalance = input.openingOperationalBalance;
  let openingReservedBalance = input.openingReservedBalance ?? 0;
  let openingNetWorth =
    input.openingNetWorth ??
    (openingOperationalBalance == null
      ? null
      : openingOperationalBalance + openingReservedBalance);

  for (const monthStart of input.months) {
    const opening = buildMonthOpeningState({
      monthStart,
      referenceDate: input.referenceDate,
      openingOperationalBalance,
      openingReservedBalance,
      openingNetWorth,
    });

    const monthState = buildForecastMonthStateFromEvents({
      opening,
      events: input.monthEventsByMonthStart.get(opening.monthStart) || [],
    });

    states.push(monthState);
    const nextOpening = extractNextMonthOpeningState(monthState);
    openingOperationalBalance = nextOpening.openingOperationalBalance;
    openingReservedBalance = nextOpening.openingReservedBalance;
    openingNetWorth = nextOpening.openingNetWorth;
  }

  return states;
}

export function buildRollForwardMonthWindow(referenceDate: Date, count: number) {
  const monthStart = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1),
  );
  return Array.from({ length: Math.max(0, count) }, (_, index) =>
    addMonths(monthStart, index),
  );
}

export function buildRollForwardMonthEndExclusive(monthStart: Date) {
  return endOfMonthExclusive(monthStart);
}
