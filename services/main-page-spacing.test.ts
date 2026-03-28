import { MainPageSpacing } from "@/components/ui/main-page-spacing";
import { describe, expect, it } from "vitest";

describe("MainPageSpacing", () => {
  it("houdt de hoofdscherm-componentspacing op de gedeelde standaard", () => {
    expect(MainPageSpacing.dashboardComponents).toBe(28);
    expect(MainPageSpacing.budgetComponents).toBe(20);
    expect(MainPageSpacing.insightsComponents).toBe(40);
    expect(MainPageSpacing.transactionsHeaderComponents).toBe(20);
    expect(MainPageSpacing.settingsComponents).toBe(12);
  });
});

