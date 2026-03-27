import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { FinanceForecastSummaryCard } from "./finance-forecast-summary-card";
import type { InsightsForecastCardModel } from "@/services/insights-forecast-card";

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

describe("FinanceForecastSummaryCard", () => {
  it("toont de compacte forecastlabels vanuit dezelfde betekenislaag", () => {
    const model: InsightsForecastCardModel = {
      title: "Verwacht eindsaldo",
      amountLabel: "€ 253,21",
      currentOperationalValue: "€ 373,21",
      freeToSpendNowValue: "€ 253,21",
      reservedValue: "€ 120,00",
      statusLabel: "Verwacht positief",
      statusTone: "good",
      lowestOperationalPointValue: "€ 185,00",
      lowestOperationalPointDateLabel: "12 mei",
      explanation: "Vrij besteedbaar € 253,21",
      isFallback: false,
    };

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<FinanceForecastSummaryCard model={model} />);
    });
    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Huidig saldo");
    expect(text).toContain("Vrij besteedbaar");
    expect(text).toContain("Gereserveerd");
    expect(text).toContain("Laagste punt");
    expect(text).toContain("Verwacht eindsaldo");
  });
});
