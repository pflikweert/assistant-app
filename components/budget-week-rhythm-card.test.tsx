import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";

import { BudgetWeekRhythmCard } from "./budget-week-rhythm-card";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

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

describe("BudgetWeekRhythmCard", () => {
  it("toont weekritme compact met besteed bedrag, richtbedrag en periode", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetWeekRhythmCard
          title="Deze week"
          periodLabel="8 mei - 14 mei"
          status="Op koers"
          remainingAmount={27}
          spentAmount={98}
          targetAmount={125}
          progress={0.78}
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

    expect(text).toContain("Deze week");
    expect(text).toContain("Op koers");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(27)));
    expect(text).toContain("resterend");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(98)));
    expect(text).toContain("uitgegeven");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(125)));
    expect(text).toContain("richtbedrag");
    expect(text).toContain("8 mei - 14 mei");
    expect(text).toContain("78 %");
    expect(text).not.toContain("Nog beschikbaar");
    expect(text).not.toContain("Verdeling van de maand");
  });

  it("ondersteunt statusvarianten voor weektempo", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetWeekRhythmCard
          title="Deze week"
          periodLabel="15 mei - 21 mei"
          status="Boven tempo"
          remainingAmount={0}
          spentAmount={150}
          targetAmount={125}
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

    expect(text).toContain("Boven tempo");
    expect(text).toContain("15 mei - 21 mei");
  });
});
