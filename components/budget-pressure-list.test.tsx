import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { BudgetPressureList } from "./budget-pressure-list";

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

describe("BudgetPressureList", () => {
  it("toont drukpunten compact en zonder neutrale labels", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetPressureList
          items={[
            {
              id: "1",
              title: "Boodschappen boven tempo",
              description: "Uitgaven lopen harder op dan gepland.",
              severity: "critical",
              icon: "shopping-basket",
            },
            {
              id: "2",
              title: "Vervoer loopt op",
              description: "Tank- en reiskosten stijgen deze maand.",
              severity: "watch",
              icon: "local-gas-station",
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

    expect(text).toContain("Waar zit druk");
    expect(text).toContain("Boodschappen boven tempo");
    expect(text).toContain("Vervoer loopt op");
    expect(text).not.toContain("Neutraal");
    expect(text).not.toContain("Op koers");
  });

  it("beperkt de lijst tot maximaal 4 items", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetPressureList
          items={[
            { id: "1", title: "A", description: "A", severity: "critical", icon: "stars" },
            { id: "2", title: "B", description: "B", severity: "watch", icon: "stars" },
            { id: "3", title: "C", description: "C", severity: "watch", icon: "stars" },
            { id: "4", title: "D", description: "D", severity: "watch", icon: "stars" },
            { id: "5", title: "E", description: "E", severity: "watch", icon: "stars" },
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

    expect(text).toContain("A");
    expect(text).toContain("D");
    expect(text).not.toContain("E");
  });
});
