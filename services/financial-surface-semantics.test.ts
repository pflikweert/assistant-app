import {
  getFinancialSurfaceTermDefinition,
  resolveFinancialSurfaceStatus,
  resolveSafetyContextCopy,
} from "@/services/financial-surface-semantics";
import { describe, expect, it } from "vitest";

describe("financial-surface-semantics", () => {
  it("houdt safety hoofdlabel stabiel op Extra ruimte", () => {
    const result = resolveSafetyContextCopy({
      anchorLabel: "Salaris Impres B.V.",
      anchorDate: "2026-04-25",
      isEstimatedAnchorDate: false,
      formatDateLabel: () => "25 april",
    });

    expect(result.primaryLabel).toBe("Extra ruimte");
    expect(result.contextLabel).toBe("tot salaris");
    expect(result.fullLabel).toBe("Extra ruimte tot salaris");
    expect(result.sheetTitle).toBe("Veilig tot salaris");
  });

  it("gebruikt contextlabel tot volgende inkomsten zonder salarisanker", () => {
    const result = resolveSafetyContextCopy({
      anchorLabel: "Toeslag",
      anchorDate: "2026-04-20",
      isEstimatedAnchorDate: true,
      formatDateLabel: () => "20 april",
    });

    expect(result.fullLabel).toBe("Extra ruimte tot volgende inkomsten");
    expect(result.sheetSubtitle).toContain("volgende inkomsten");
    expect(result.sheetSubtitle).toContain("20 april");
  });

  it("statusresolver kiest Let op bij negatieve forecast", () => {
    const result = resolveFinancialSurfaceStatus({
      activeMonthLabel: "maart",
      expectedEndOperationalBalance: -30,
      remainingMonthlyBudget: 250,
      monthBudgetTone: "good",
    });

    expect(result.label).toBe("Let op voor maart");
    expect(result.tone).toBe("critical");
  });

  it("statusresolver kiest Let op bij kritieke budgetdruk ondanks positieve forecast", () => {
    const result = resolveFinancialSurfaceStatus({
      activeMonthLabel: "maart",
      expectedEndOperationalBalance: 1803.31,
      remainingMonthlyBudget: -12,
      monthBudgetTone: "critical",
    });

    expect(result.label).toBe("Let op voor maart");
    expect(result.tone).toBe("critical");
  });

  it("statusresolver kiest Op schema in stabiele case", () => {
    const result = resolveFinancialSurfaceStatus({
      activeMonthLabel: "maart",
      expectedEndOperationalBalance: 1803.31,
      remainingMonthlyBudget: 0,
      monthBudgetTone: "watch",
    });

    expect(result.label).toBe("Je zit op schema voor maart");
    expect(result.tone).toBe("good");
  });

  it("houdt termdefinities expliciet", () => {
    expect(getFinancialSurfaceTermDefinition("remainingMonthlyBudget").label).toBe(
      "Resterend budget",
    );
    expect(
      getFinancialSurfaceTermDefinition("safeToSpendUntilNextIncome").label,
    ).toBe("Extra ruimte");
  });
});

