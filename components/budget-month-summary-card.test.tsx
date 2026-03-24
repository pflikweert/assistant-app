import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { BudgetMonthSummaryCard } from "./budget-month-summary-card";

vi.mock("@/components/ui/app-icon", () => ({
  AppIcon: ({ name }: { name: string }) => <Text>{name}</Text>,
}));

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

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

describe("BudgetMonthSummaryCard", () => {
  it("toont de compacte maandsamenvatting zonder extra budgetonderdelen", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetMonthSummaryCard
          title="Deze maand"
          status="Op koers"
          remainingAmount={540}
          usedAmount={590}
          totalVariableAmount={1130}
          tone="good"
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" "),
    );

    expect(text).toContain("Deze maand");
    expect(text).toContain("Op koers");
    expect(text).toContain("Nog beschikbaar");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(540)));
    expect(text).toContain(
      normalizeWhitespace(
        `${euroFormatter.format(590)} gebruikt van ${euroFormatter.format(1130)}`,
      ),
    );
    expect(text).not.toContain("Inkomend budget");
    expect(text).not.toContain("Vaste lasten");
    expect(text).not.toContain("Abonnementen");
    expect(text).not.toContain("Sparen");
  });

  it("rendert ook de andere statusvarianten", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetMonthSummaryCard
          title="Deze maand"
          status="Onder druk"
          remainingAmount={0}
          usedAmount={1130}
          totalVariableAmount={1130}
          tone="critical"
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" "),
    );

    expect(text).toContain("Onder druk");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(0)));
  });
});
