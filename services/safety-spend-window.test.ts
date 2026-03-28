import { beforeEach, describe, expect, it, vi } from "vitest";

const { listForecastTimelineEventsMock } = vi.hoisted(() => ({
  listForecastTimelineEventsMock: vi.fn(),
}));

const { supabaseFromMock } = vi.hoisted(() => ({
  supabaseFromMock: vi.fn(),
}));

vi.mock("@/services/forecast-timeline-events", () => ({
  listForecastTimelineEvents: listForecastTimelineEventsMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: supabaseFromMock,
  },
}));

let buildSafetySpendWindowSummary: typeof import("./safety-spend-window").buildSafetySpendWindowSummary;

describe("buildSafetySpendWindowSummary", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ buildSafetySpendWindowSummary } = await import("./safety-spend-window"));
    listForecastTimelineEventsMock.mockReset();
    supabaseFromMock.mockReset();
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }),
    });
  });

  it("rekent veilig te besteden tot volgende inkomen over maandgrens", async () => {
    listForecastTimelineEventsMock
      .mockResolvedValueOnce([
        {
          eventKey: "credit-interest",
          eventDate: "2026-03-29",
          eventType: "income",
          label: "Creditrente",
          amount: 0.33,
          source: "recurring_history",
          confidence: "high",
          fingerprint: "credit-interest",
        },
        {
          eventKey: "rent",
          eventDate: "2026-03-28",
          eventType: "fixed_cost",
          label: "Huur",
          amount: 736.58,
          source: "recurring_history",
          confidence: "high",
          fingerprint: "rent",
        },
        {
          eventKey: "var",
          eventDate: "2026-03-30",
          eventType: "fixed_cost",
          label: "Variabel tempo",
          amount: 214,
          source: "derived",
          confidence: "medium",
          fingerprint: "var",
        },
      ])
      .mockResolvedValueOnce([
        {
          eventKey: "salary",
          eventDate: "2026-04-24",
          eventType: "income",
          label: "Salaris",
          amount: 2500,
          source: "income_source",
          confidence: "high",
          fingerprint: "salary",
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: 2648.36,
    });

    expect(result.projectedNetUntilNextIncome).toBe(-950.25);
    expect(result.safeToSpendUntilNextIncome).toBe(1698.11);
    expect(result.nextIncomeDateAnchor).toBe("2026-04-24");
    expect(result.anchorType).toBe("configured");
    expect(result.isEstimatedAnchorDate).toBe(false);
    expect(result.safeToSpendExplanation).toContain("salaris");
    expect(result.safeToSpendExplanation).toContain("24 april");
    expect(result.confidenceScore).toBe("MEDIUM");
    expect(result.deltaReasonLabel).toBe("Huur");
  });

  it("houdt free-to-spend op null als die bron ontbreekt", async () => {
    listForecastTimelineEventsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          eventKey: "salary",
          eventDate: "2026-04-24",
          eventType: "income",
          label: "Salaris",
          amount: 2500,
          source: "income_source",
          confidence: "high",
          fingerprint: "salary",
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: null,
    });

    expect(result.safeToSpendUntilNextIncome).toBeNull();
    expect(result.confidenceScore).toBe("MEDIUM");
  });

  it("gebruikt forecast-summary anker en resterende maandmutatie als timeline te zwak is", async () => {
    listForecastTimelineEventsMock
      .mockResolvedValueOnce([
        {
          eventKey: "credit-interest",
          eventDate: "2026-03-29",
          eventType: "income",
          label: "Creditrente",
          amount: 0.33,
          source: "recurring_history",
          confidence: "high",
          fingerprint: "credit-interest",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: 2648.36,
      forecastSummary: {
        monthStart: "2026-03-01",
        forecastReferenceDate: "2026-03-25",
        currentBalanceAnchor: 2748.36,
        currentBalanceAnchorDate: "2026-03-25",
        cashRiskFlag: "none",
        riskFlag: "none",
        expectedEndBalance: 1803.31,
        lowestExpectedBalance: 392.82,
        lowestExpectedBalanceDate: "2026-03-28",
        nextExpectedEventDate: "2026-04-24",
        nextExpectedEventLabel: "Salaris",
        expectedIncomeTotal: null,
        remainingExpectedIncomeTotal: 0.33,
        remainingExpectedExpenseTotal: 950.58,
        remainingExpectedSavingsOutflowTotal: 0,
        upcomingCommittedIncomeTotal: null,
        upcomingCommittedExpenseTotal: null,
        expectedFixedCosts: null,
        expectedSubscriptions: null,
        expectedVariableCosts: null,
      },
    });

    expect(result.nextIncomeDateAnchor).toBe("2026-04-24");
    expect(result.nextIncomeLabelAnchor).toBe("Salaris");
    expect(result.anchorType).toBe("configured");
    expect(result.isEstimatedAnchorDate).toBe(false);
    expect(result.projectedNetUntilNextIncome).toBe(-950.25);
    expect(result.safeToSpendUntilNextIncome).toBe(1698.11);
    expect(result.safeToSpendExplanation).toContain("salaris");
    expect(result.safeToSpendExplanation).toContain("24 april");
  });

  it("gebruikt fallback tot einde volgende maand als geen hoofdinkomen binnen 31 dagen bestaat", async () => {
    listForecastTimelineEventsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: 1000,
      forecastSummary: {
        monthStart: "2026-03-01",
        forecastReferenceDate: "2026-03-25",
        currentBalanceAnchor: 1000,
        currentBalanceAnchorDate: "2026-03-25",
        cashRiskFlag: "none",
        riskFlag: "none",
        expectedEndBalance: 900,
        lowestExpectedBalance: 700,
        lowestExpectedBalanceDate: "2026-03-29",
        nextExpectedEventDate: null,
        nextExpectedEventLabel: null,
        expectedIncomeTotal: null,
        remainingExpectedIncomeTotal: 0,
        remainingExpectedExpenseTotal: 100,
        remainingExpectedSavingsOutflowTotal: 0,
        upcomingCommittedIncomeTotal: null,
        upcomingCommittedExpenseTotal: null,
        expectedFixedCosts: null,
        expectedSubscriptions: null,
        expectedVariableCosts: null,
      },
    });

    expect(result.anchorType).toBe("fallback_end_next_month");
    expect(result.isEstimatedAnchorDate).toBe(true);
    expect(result.nextIncomeDateAnchor).toBe("2026-04-30");
    expect(result.confidenceScore).toBe("INDICATIVE");
  });

  it("kiest ingestelde hoofdinkomstenbron uit forecast_income_sources boven mini-inkomsten", async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  source_label: "Salaris",
                  expected_income: 2800,
                  income_bucket: "salary",
                  income_frequency: "monthly",
                  income_day_of_month: 24,
                  last_detected_at: "2026-02-24T12:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });
    listForecastTimelineEventsMock
      .mockResolvedValueOnce([
        {
          eventKey: "credit-interest",
          eventDate: "2026-03-29",
          eventType: "income",
          label: "Creditrente",
          amount: 0.33,
          source: "recurring_history",
          confidence: "high",
          fingerprint: "credit-interest",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: 2648.36,
      includeIncomeSettings: {
        salary: true,
        childBudget: false,
        structuralOther: false,
        variable: false,
      },
      forecastSummary: {
        monthStart: "2026-03-01",
        forecastReferenceDate: "2026-03-25",
        currentBalanceAnchor: 2748.36,
        currentBalanceAnchorDate: "2026-03-25",
        cashRiskFlag: "none",
        riskFlag: "none",
        expectedEndBalance: 1803.31,
        lowestExpectedBalance: 392.82,
        lowestExpectedBalanceDate: "2026-03-28",
        nextExpectedEventDate: "2026-03-29",
        nextExpectedEventLabel: "Creditrente",
        expectedIncomeTotal: null,
        remainingExpectedIncomeTotal: 0.33,
        remainingExpectedExpenseTotal: 950.58,
        remainingExpectedSavingsOutflowTotal: 0,
        upcomingCommittedIncomeTotal: null,
        upcomingCommittedExpenseTotal: null,
        expectedFixedCosts: null,
        expectedSubscriptions: null,
        expectedVariableCosts: null,
      },
    });

    expect(result.anchorType).toBe("configured");
    expect(result.nextIncomeDateAnchor).toBe("2026-04-24");
    expect(result.nextIncomeLabelAnchor?.toLowerCase()).toContain("salaris");
  });

  it("kiest geen incidentele hoge bijschrijving als primary anchor wanneer een recurring hoofdinkomen bestaat", async () => {
    listForecastTimelineEventsMock
      .mockResolvedValueOnce([
        {
          eventKey: "windfall",
          eventDate: "2026-03-29",
          eventType: "income",
          label: "Incidentele teruggave",
          amount: 1900,
          source: "derived",
          confidence: "medium",
          fingerprint: "windfall",
        },
      ])
      .mockResolvedValueOnce([
        {
          eventKey: "salary",
          eventDate: "2026-04-24",
          eventType: "income",
          label: "Salaris",
          amount: 2800,
          source: "recurring_history",
          confidence: "high",
          fingerprint: "salary",
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: 1200,
      includeIncomeSettings: {
        salary: true,
        childBudget: false,
        structuralOther: false,
        variable: false,
      },
    });

    expect(result.nextIncomeDateAnchor).toBe("2026-04-24");
    expect(result.nextIncomeLabelAnchor?.toLowerCase()).toContain("salaris");
    expect(result.anchorType).not.toBe("significant_fallback");
  });

  it("kiest zonder salaris de eerstvolgende relevante recurring hoofdinkomstenbron", async () => {
    supabaseFromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [
                {
                  source_label: "Uitkering",
                  expected_income: 1450,
                  income_bucket: "structuralOther",
                  income_frequency: "monthly",
                  income_day_of_month: 20,
                  last_detected_at: "2026-02-20T12:00:00.000Z",
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    listForecastTimelineEventsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await buildSafetySpendWindowSummary({
      userId: "user-1",
      moneyViewScope: "personal",
      referenceDate: new Date("2026-03-25T12:00:00.000Z"),
      freeToSpendNow: 900,
      includeIncomeSettings: {
        salary: false,
        childBudget: false,
        structuralOther: true,
        variable: false,
      },
    });

    expect(result.nextIncomeDateAnchor).toBe("2026-04-20");
    expect(result.nextIncomeLabelAnchor?.toLowerCase()).toContain("uitkering");
    expect(result.anchorType).toBe("configured");
  });
});
