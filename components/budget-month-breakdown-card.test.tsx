import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { BudgetMonthBreakdownCard } from "./budget-month-breakdown-card";

vi.mock("@/components/ui/app-icon", () => ({
  AppIcon: ({ name }: { name: string }) => <Text>{name}</Text>,
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

describe("BudgetMonthBreakdownCard", () => {
  it("toont de maandverdeling als compacte lijstkaart", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetMonthBreakdownCard
          items={[
            {
              key: "income",
              label: "Inkomend",
              description: "deze maand",
              amount: 3200,
              icon: "account-balance-wallet",
              tone: "good",
            },
            {
              key: "fixed",
              label: "Vaste lasten",
              description: "vast gepland",
              amount: 1400,
              icon: "home",
            },
            {
              key: "subscriptions",
              label: "Abonnementen",
              description: "terugkerende kosten",
              amount: 120,
              icon: "subscriptions",
            },
            {
              key: "savings",
              label: "Sparen",
              description: "doel deze maand",
              amount: 550,
              icon: "savings",
            },
            {
              key: "variable",
              label: "Variabele ruimte",
              description: "vrij te besteden",
              amount: 1130,
              icon: "shopping-bag",
              tone: "watch",
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

    expect(text).toContain("Verdeling van de maand");
    expect(text).toContain("Inkomend");
    expect(text).toContain("Vaste lasten");
    expect(text).toContain("Abonnementen");
    expect(text).toContain("Sparen");
    expect(text).toContain("Variabele ruimte");
    expect(text).toContain("deze maand");
    expect(text).toContain("vast gepland");
    expect(text).toContain("terugkerende kosten");
    expect(text).toContain("doel deze maand");
    expect(text).toContain("vrij te besteden");
    expect(text).toContain("€ 3.200,00");
    expect(text).toContain("€ 1.400,00");
    expect(text).toContain("€ 120,00");
    expect(text).toContain("€ 550,00");
    expect(text).toContain("€ 1.130,00");
    expect(text).not.toContain("Nog beschikbaar");
    expect(text).not.toContain("Op koers");
    expect(text).not.toContain("Let op");
    expect(text).not.toContain("Onder druk");
  });
});
