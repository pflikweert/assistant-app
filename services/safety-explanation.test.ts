import { buildSafeToSpendExplanation } from "@/services/safety-explanation";
import { describe, expect, it } from "vitest";

describe("buildSafeToSpendExplanation", () => {
  it("bouwt een rustige uitlegstring met lasten tot volgende inkomen", () => {
    const text = buildSafeToSpendExplanation({
      incomeLabel: "Salaris",
      incomeDate: "2026-04-24",
      projectedCosts: 950.25,
      projectedIncome: 0,
      windowStart: "2026-03-25",
      windowEnd: "2026-04-24",
      confidence: "medium",
    });

    expect(text).toContain("salaris");
    expect(text).toContain("24 april");
    expect(text).toContain("€");
  });

  it("gebruikt indicatieve variant bij lage confidence", () => {
    const text = buildSafeToSpendExplanation({
      incomeLabel: "inkomen",
      incomeDate: "2026-04-24",
      projectedCosts: 400,
      projectedIncome: 0,
      windowStart: "2026-03-25",
      windowEnd: "2026-04-24",
      confidence: "low",
    });

    expect(text?.toLowerCase()).toContain("indicatief");
  });
});
