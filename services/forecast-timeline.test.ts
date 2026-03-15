import { describe, expect, it } from "vitest";

import {
  buildForecastTimelineProjection,
  buildScheduledDateForMonth,
  frequencyAppliesInMonth,
  resolveExpectedDayOfMonth,
} from "./forecast-timeline";

describe("resolveExpectedDayOfMonth", () => {
  it("uses the median day across recurring history", () => {
    expect(
      resolveExpectedDayOfMonth([
        "2026-01-24",
        "2026-02-25",
        "2026-03-24",
      ]),
    ).toBe(24);
  });

  it("returns null when no valid history exists", () => {
    expect(resolveExpectedDayOfMonth([])).toBeNull();
  });
});

describe("buildScheduledDateForMonth", () => {
  it("clamps the day inside the target month", () => {
    expect(
      buildScheduledDateForMonth(new Date("2026-02-01T00:00:00.000Z"), 31),
    ).toBe("2026-02-28");
  });
});

describe("frequencyAppliesInMonth", () => {
  it("supports monthly, quarterly and yearly anchors", () => {
    expect(
      frequencyAppliesInMonth(
        "monthly",
        new Date("2026-01-25T00:00:00.000Z"),
        new Date("2026-03-01T00:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      frequencyAppliesInMonth(
        "quarterly",
        new Date("2026-01-25T00:00:00.000Z"),
        new Date("2026-04-01T00:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      frequencyAppliesInMonth(
        "yearly",
        new Date("2025-05-25T00:00:00.000Z"),
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    ).toBe(true);
  });
});

describe("buildForecastTimelineProjection", () => {
  it("computes the next event and lowest expected balance conservatively", () => {
    const projection = buildForecastTimelineProjection({
      currentBalanceAnchor: 200,
      referenceDate: new Date("2026-03-15T00:00:00.000Z"),
      monthEndExclusive: new Date("2026-04-01T00:00:00.000Z"),
      events: [
        {
          date: "2026-03-20",
          label: "Zorgverzekering",
          amount: -160,
          kind: "fixed_cost",
          source: "recurring_history",
          confidence: "high",
        },
        {
          date: "2026-03-25",
          label: "Salaris",
          amount: 2400,
          kind: "income",
          source: "income_source",
          confidence: "high",
        },
        {
          date: "2026-03-20",
          label: "Spotify",
          amount: -12,
          kind: "subscription",
          source: "recurring_history",
          confidence: "high",
        },
      ],
    });

    expect(projection.nextExpectedEventDate).toBe("2026-03-20");
    expect(projection.nextExpectedEventLabel).toBe("Zorgverzekering");
    expect(projection.upcomingCommittedIncomeTotal).toBe(2400);
    expect(projection.upcomingCommittedExpenseTotal).toBe(172);
    expect(projection.lowestExpectedBalance).toBe(28);
    expect(projection.lowestExpectedBalanceDate).toBe("2026-03-20");
    expect(projection.cashRiskFlag).toBe("none");
  });

  it("flags a cash gap when the projected low point drops below zero", () => {
    const projection = buildForecastTimelineProjection({
      currentBalanceAnchor: 50,
      referenceDate: new Date("2026-03-15T00:00:00.000Z"),
      monthEndExclusive: new Date("2026-04-01T00:00:00.000Z"),
      events: [
        {
          date: "2026-03-18",
          label: "Huur",
          amount: -900,
          kind: "fixed_cost",
          source: "recurring_history",
          confidence: "high",
        },
      ],
    });

    expect(projection.lowestExpectedBalance).toBe(-850);
    expect(projection.cashRiskFlag).toBe("cash_gap_warning");
  });
});
