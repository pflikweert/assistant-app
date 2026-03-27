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
  it("toont operationele stand, vrije ruimte en forecastmeta compact", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={buildBalances()}
          monthLabel="mei 2026"
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

    expect(text).toContain("Vrij besteedbaar");
    expect(compactText).toContain("€1.200,40");
    expect(text).toContain("Verwacht eindsaldo");
    expect(text).toContain("Huidig saldo");
    expect(text).toContain("Gereserveerd");
    expect(text).toContain("Totaal vermogen");
    expect(text).toContain("Je zit op schema voor mei 2026");
  });

  it("toont reserved state expliciet wanneer die niet is gemodelleerd", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <DashboardBalanceSummary
          surfaceBalances={{
            ...buildBalances(),
            currentReservedBalance: { amount: null, source: "not_configured" },
            reservedBalance: { amount: null, source: "not_configured" },
          }}
          monthLabel="mei 2026"
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

    expect(text).toContain("Gereserveerd");
    expect(text).toContain("n.b.");
  });

  it("toont een rustige toelichting wanneer vrij besteedbaar nog niet te bepalen is", () => {
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
          monthLabel="mei 2026"
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

    expect(text).toContain("Nog niet vast te stellen");
    expect(text.toLowerCase()).toContain("gereserveerd geld bekend");
    expect(text).not.toContain("maandbudget");
    expect(text).not.toContain("weekbudget");
  });
});
