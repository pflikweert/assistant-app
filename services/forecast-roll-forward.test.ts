import { describe, expect, it } from "vitest";

import { buildForecastMonthStateFromEvents } from "./forecast-month-math";
import { buildForecastTimelineProjection } from "./forecast-timeline";
import { rollForwardForecastMonths } from "./forecast-roll-forward";

describe("buildForecastMonthStateFromEvents", () => {
  it("verwerkt income, expense, reserve allocation en internal transfer per geldlaag", () => {
    const state = buildForecastMonthStateFromEvents({
      opening: {
        monthStart: "2026-03-01",
        referenceDate: "2026-03-10",
        currentBalanceDate: "2026-03-09",
        openingOperationalBalance: 1000,
        openingReservedBalance: 200,
        openingNetWorth: 1200,
        carryover: null,
      },
      events: [
        {
          id: "income-1",
          date: "2026-03-12",
          type: "income",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 500,
          label: "Salaris",
          accountRole: "operational",
          ownerScope: "personal",
        },
        {
          id: "expense-1",
          date: "2026-03-13",
          type: "expense",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 100,
          label: "Boodschappen",
          accountRole: "operational",
          ownerScope: "personal",
        },
        {
          id: "reserve-1",
          date: "2026-03-14",
          type: "reserve_allocation",
          certainty: "committed",
          moneyLayer: "reserved",
          amount: 300,
          label: "Naar sparen",
          accountRole: "reserve",
          ownerScope: "personal",
          carryover: {
            sourceMonthStart: "2026-03-01",
            targetMonthStart: "2026-03-01",
            sourceMoneyLayer: "operational",
            targetMoneyLayer: "reserved",
            amount: 300,
            certainty: "committed",
            sourceEventType: "reserve_allocation",
            sourceLabel: "Naar sparen",
            reason: "Spaarboeking",
          },
        },
        {
          id: "internal-1",
          date: "2026-03-15",
          type: "internal_transfer",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 50,
          label: "Eigen overboeking",
          accountRole: "operational",
          ownerScope: "personal",
        },
      ],
    });

    expect(state.openingOperationalBalance).toBe(1000);
    expect(state.openingReservedBalance).toBe(200);
    expect(state.expectedIncome).toBe(500);
    expect(state.expectedExpenses).toBe(100);
    expect(state.expectedReserveAllocations).toBe(300);
    expect(state.expectedInternalTransfers).toBe(50);
    expect(state.expectedEndOperationalBalance).toBe(1100);
    expect(state.expectedEndReservedBalance).toBe(500);
    expect(state.expectedEndNetWorth).toBe(1600);
    expect(state.freeToSpendCarryover).toBe(600);
    expect(state.lowestExpectedBalance).toBe(1000);

    const projection = buildForecastTimelineProjection({
      currentBalanceAnchor: 1000,
      referenceDate: new Date("2026-03-10T00:00:00.000Z"),
      monthEndExclusive: new Date("2026-04-01T00:00:00.000Z"),
      events: state.events,
    });

    expect(projection.upcomingCommittedIncomeTotal).toBe(500);
    expect(projection.upcomingCommittedExpenseTotal).toBe(100);
    expect(projection.upcomingCommittedSavingsOutflowTotal).toBe(300);
    expect(projection.lowestExpectedBalance).toBe(1000);
  });

  it("houdt lowest point apart van de month-end balance", () => {
    const state = buildForecastMonthStateFromEvents({
      opening: {
        monthStart: "2026-03-01",
        referenceDate: "2026-03-10",
        currentBalanceDate: "2026-03-09",
        openingOperationalBalance: 1000,
        openingReservedBalance: 0,
        openingNetWorth: 1000,
        carryover: null,
      },
      events: [
        {
          id: "expense-early",
          date: "2026-03-12",
          type: "expense",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 450,
          label: "Vaste last",
          accountRole: "operational",
          ownerScope: "personal",
        },
        {
          id: "income-mid",
          date: "2026-03-20",
          type: "income",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 300,
          label: "Inkomende betaling",
          accountRole: "operational",
          ownerScope: "personal",
        },
        {
          id: "expense-late",
          date: "2026-03-28",
          type: "expense",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 100,
          label: "Variabele uitgave",
          accountRole: "operational",
          ownerScope: "personal",
        },
      ],
    });

    expect(state.expectedEndOperationalBalance).toBe(750);
    expect(state.lowestExpectedBalance).toBe(550);
    expect(state.expectedEndOperationalBalance).not.toBe(state.lowestExpectedBalance);
  });

  it("laat correction events de eindstand ongemoeid", () => {
    const state = buildForecastMonthStateFromEvents({
      opening: {
        monthStart: "2026-03-01",
        referenceDate: "2026-03-10",
        currentBalanceDate: "2026-03-09",
        openingOperationalBalance: 750,
        openingReservedBalance: 100,
        openingNetWorth: 850,
        carryover: null,
      },
      events: [
        {
          id: "correction-1",
          date: "2026-03-11",
          type: "correction",
          certainty: "booked",
          moneyLayer: "operational",
          amount: 999,
          label: "Saldo correctie",
          accountRole: "operational",
          ownerScope: "personal",
        },
      ],
    });

    expect(state.expectedEndOperationalBalance).toBe(750);
    expect(state.expectedEndReservedBalance).toBe(100);
    expect(state.expectedEndNetWorth).toBe(850);
  });
});

describe("rollForwardForecastMonths", () => {
  it("neemt de eindstand van maand 1 mee als opening van maand 2 en maand 3", () => {
    const monthEventsByMonthStart = new Map([
      [
        "2026-03-01",
        [
          {
            id: "m1-income",
            date: "2026-03-12",
            type: "income",
            certainty: "booked",
            moneyLayer: "operational",
            amount: 200,
            label: "Maand 1 inkomen",
            accountRole: "operational",
            ownerScope: "personal",
          },
        ],
      ],
      [
        "2026-04-01",
        [
          {
            id: "m2-expense",
            date: "2026-04-10",
            type: "expense",
            certainty: "committed",
            moneyLayer: "operational",
            amount: 100,
            label: "Maand 2 uitgave",
            accountRole: "operational",
            ownerScope: "personal",
          },
        ],
      ],
      [
        "2026-05-01",
        [
          {
            id: "m3-reserve",
            date: "2026-05-05",
            type: "reserve_allocation",
            certainty: "committed",
            moneyLayer: "reserved",
            amount: 50,
            label: "Maand 3 sparen",
            accountRole: "reserve",
            ownerScope: "personal",
            carryover: {
              sourceMonthStart: "2026-05-01",
              targetMonthStart: "2026-05-01",
              sourceMoneyLayer: "operational",
              targetMoneyLayer: "reserved",
              amount: 50,
              certainty: "committed",
              sourceEventType: "reserve_allocation",
              sourceLabel: "Maand 3 sparen",
              reason: "Spaarboeking",
            },
          },
        ],
      ],
    ]);

    const months = [
      new Date("2026-03-01T00:00:00.000Z"),
      new Date("2026-04-01T00:00:00.000Z"),
      new Date("2026-05-01T00:00:00.000Z"),
    ];

    const states = rollForwardForecastMonths({
      months,
      referenceDate: new Date("2026-03-10T00:00:00.000Z"),
      monthEventsByMonthStart,
      openingOperationalBalance: 1000,
      openingReservedBalance: 0,
      openingNetWorth: 1000,
    });

    expect(states).toHaveLength(3);
    expect(states[0]?.openingOperationalBalance).toBe(1000);
    expect(states[0]?.expectedEndOperationalBalance).toBe(1200);
    expect(states[1]?.openingOperationalBalance).toBe(1200);
    expect(states[1]?.expectedEndOperationalBalance).toBe(1100);
    expect(states[2]?.openingOperationalBalance).toBe(1100);
    expect(states[2]?.expectedEndOperationalBalance).toBe(1050);
    expect(states[2]?.expectedEndReservedBalance).toBe(50);
  });
});
