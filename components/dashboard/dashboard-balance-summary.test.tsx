import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { DashboardBalanceSummary } from "./dashboard-balance-summary";
import type { FinancialSurfaceBalanceSnapshot } from "@/services/financial-semantics";

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

function buildBalances(): FinancialSurfaceBalanceSnapshot {
  const value = (
    amount: number | null,
    source: FinancialSurfaceBalanceSnapshot["operationalBalance"]["source"] = "forecast_anchor",
  ) => ({
    amount,
    source,
  });

  return {
    operationalBalance: value(12450.8),
    reservedBalance: value(250),
    netWorth: value(13250.8),
    freeToSpend: { amount: 4200.4, source: "budget_remaining" },
    currentOperationalBalance: value(12450.8),
    currentReservedBalance: value(250),
    currentNetWorth: value(13250.8),
    freeToSpendNow: value(1200.4),
    expectedEndOperationalBalance: value(11980.3),
    expectedEndNetWorth: value(12730.3),
    carryoverIntoNextMonth: value(11980.3),
    lowestOperationalPointInMonth: value(11850),
  };
}

describe("DashboardBalanceSummary", () => {
  it("maakt de resterend-budgettekst klikbaar wanneer een callback is meegegeven", () => {
    const onPressRemainingBudgetLabel = vi.fn();
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={buildBalances()}
          activeMonthLabel="maart"
          remainingMonthlyBudget={120}
          hasTransactions
          onPressRemainingBudgetLabel={onPressRemainingBudgetLabel}
        />,
      );
    });

    const kickerButton = tree.root.findByProps({
      accessibilityRole: "button",
    });

    expect(kickerButton).toBeDefined();

    act(() => {
      kickerButton.props.onPress();
    });
    expect(onPressRemainingBudgetLabel).toHaveBeenCalledTimes(1);
  });

  it("toont maandbudget als hoofdanker met contextvelden", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={buildBalances()}
          activeMonthLabel="mei"
          remainingMonthlyBudget={253.21}
          hasTransactions
          confidenceLabel="Hoog vertrouwen"
          safeToSpendUntilNextIncome={980.15}
          safeToSpendContextLabel="Extra ruimte tot salaris"
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );
    const compactText = text.replace(/\s+/g, "");

    expect(text).toContain("Resterend budget mei");
    expect(compactText).toContain("€253,21");
    expect(text).toContain("Verwacht eindsaldo");
    expect(text).toContain("Saldo nu");
    expect(text).toContain("Extra ruimte tot salaris");
    expect(text).toContain("Totaal vermogen");
    expect(text).toContain("Je zit op schema voor mei");
    expect(text).not.toContain("Hoog vertrouwen");
  });

  it("toont extra ruimte los van reserved state", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={{
            ...buildBalances(),
            currentReservedBalance: { amount: null, source: "not_configured" },
            reservedBalance: { amount: null, source: "not_configured" },
          }}
          activeMonthLabel="mei"
          remainingMonthlyBudget={253.21}
          hasTransactions
          safeToSpendUntilNextIncome={340}
          safeToSpendContextLabel="Extra ruimte tot salaris"
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Extra ruimte tot salaris");
    expect(text).toContain("€340,00");
  });

  it("toont een rustige toelichting wanneer maandbudget nog niet te bepalen is", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={{
            ...buildBalances(),
            currentReservedBalance: { amount: null, source: "not_configured" },
            reservedBalance: { amount: null, source: "not_configured" },
            freeToSpendNow: { amount: null, source: "unavailable" },
          }}
          activeMonthLabel="mei"
          remainingMonthlyBudget={null}
          hasTransactions
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Nog niet bekend");
    expect(text.toLowerCase()).toContain("maandbudget");
    expect(text).toContain("mei");
  });

  it("verbergt totaal vermogen als het geen extra context geeft", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={{
            ...buildBalances(),
            currentNetWorth: { amount: null, source: "unavailable" },
          }}
          activeMonthLabel="mei"
          remainingMonthlyBudget={253.21}
          hasTransactions
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Saldo nu");
    expect(text).toContain("Extra ruimte tot volgende inkomsten");
    expect(text).not.toContain("Totaal vermogen");
  });

  it("toont negatieve bedragen met minteken", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={buildBalances()}
          activeMonthLabel="mei"
          remainingMonthlyBudget={-317.73}
          hasTransactions
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );
    const compactText = text.replace(/\s+/g, "");

    expect(compactText).toContain("-€317,73");
  });

  it("toont let-op status bij maandbudgetdruk ook als forecast positief is", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={buildBalances()}
          activeMonthLabel="maart"
          remainingMonthlyBudget={-12}
          monthBudgetTone="critical"
          hasTransactions
        />,
      );
    });

    const text = normalizeWhitespace(
      tree.root
        .findAllByType(Text)
        .flatMap((node) => flattenText(node.props.children))
        .join(" "),
    );

    expect(text).toContain("Let op voor maart");
    expect(text).not.toContain("Je zit op schema voor maart");
  });
});
