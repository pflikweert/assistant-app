import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { BudgetWeekBreakdownModal } from "./budget-week-breakdown-modal";

vi.mock("@/components/ui/finance-bottom-sheet-shell", () => ({
  FinanceBottomSheetShell: ({
    title,
    subtitle,
    children,
  }: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      <Text>{title}</Text>
      <Text>{subtitle}</Text>
      {children}
    </>
  ),
}));

vi.mock("@/components/budget-category-progress-row", () => ({
  BudgetCategoryProgressRow: ({ label }: { label: string }) => <Text>{label}</Text>,
}));

function flattenText(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string" || typeof value === "number") {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenText(item));
  }
  return flattenText((value as { children?: unknown }).children);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

describe("BudgetWeekBreakdownModal", () => {
  it("toont weekonderverdeling per variabele categorie", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetWeekBreakdownModal
          visible
          onClose={() => {}}
          title="Week 19"
          periodLabel="8 mei - 14 mei"
          totalSpent={98}
          totalBudget={125}
          items={[
            {
              key: "groceries",
              label: "Boodschappen",
              iconName: "shopping-basket",
              usedAmount: 64,
              totalBudget: 80,
            },
            {
              key: "fuel",
              label: "Vervoer",
              iconName: "local-gas-station",
              usedAmount: 34,
              totalBudget: 45,
            },
          ]}
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Week 19");
    expect(text).toContain("8 mei - 14 mei");
    expect(text).toContain("variabele uitgaven per categorie");
    expect(text).toContain("Totaal gebruikt");
    expect(text).toContain("Totaal budget");
    expect(text).toContain("Resterend");
    expect(text).toContain("Boodschappen");
    expect(text).toContain("Vervoer");
    expect(text).toContain("Gebruikt");
    expect(text).toContain("Budget");
  });
});
