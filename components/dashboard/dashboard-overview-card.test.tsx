import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import {
  buildDashboardBudgetOverviewModel,
  DashboardBudgetOverviewCard,
} from "./dashboard-overview-card";
import type { BudgetPlanComputation } from "@/types/categorization";

vi.mock("@/components/ui/app-icon", () => ({
  AppIcon: ({ name }: { name: string }) => <Text>{name}</Text>,
}));

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

describe("DashboardBudgetOverviewCard", () => {
  it("toont maand- en weekinformatie samen zonder data te verliezen", () => {
    const model = buildDashboardBudgetOverviewModel({
      referenceDate: "2026-05-15",
      flowSummary: {
        variableBudget: 1550,
      },
      monthToDateExpenses: {
        variableCosts: 1010,
      },
      monthProgress: 0.65,
      weeklyVariablePlan: [
        {
          weekNumber: 3,
          label: "Op schema",
          startDate: "2026-05-11",
          endDateExclusive: "2026-05-18",
          daysInCurrentMonth: 7,
          daysInPreviousMonth: 0,
          daysInNextMonth: 0,
          crossesMonthBoundary: false,
          baseBudget: 125,
          budget: 125,
          guardrailBudgetFloor: null,
          actual: 98,
          remaining: 27,
          utilization: 0.784,
          isCurrentWeek: true,
          isPastWeek: false,
          wasRebalanced: false,
          rebalanceMode: "none",
          overrunAmount: 0,
        },
      ],
    } as unknown as BudgetPlanComputation);

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBudgetOverviewCard model={model} />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Nog te besteden (maand)");
    expect(text).toContain("MEI");
    expect(text).toContain("Op schema");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(540)));
    expect(text).toContain("65% verbruikt");
    expect(text).toContain(`Doel: ${normalizeWhitespace(euroFormatter.format(1550))}`);
    expect(text).toContain("Weekbudget status");
    expect(text).toContain("11 mei - 17 mei");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(27)));
    expect(text).toContain("resterend");
    expect(text).toContain("3 dagen resterend");
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(98)));
    expect(text).toContain(normalizeWhitespace(euroFormatter.format(125)));
    expect(text).toContain("boven je weektempo");
  });
});
