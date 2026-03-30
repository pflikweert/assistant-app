import React from "react";
import renderer, { act } from "react-test-renderer";
import { Pressable, ScrollView, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import * as ReactNative from "react-native";

import {
  BUDGET_SETUP_ALL_STRATEGIES,
  BUDGET_SETUP_SMART_STRATEGIES,
  BUDGET_SETUP_STRATEGY_COPY,
} from "@/services/budget-setup-strategy-copy";
import { BudgetSetupStrategySelector } from "./budget-setup-strategy-selector";

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

describe("BudgetSetupStrategySelector", () => {
  it("toont alleen de slimme strategieën en selecteert balans standaard", () => {
    let tree!: renderer.ReactTestRenderer;
    const onChange = vi.fn();

    act(() => {
      tree = renderer.create(
        <BudgetSetupStrategySelector
          selectedStrategy="balans"
          visibleStrategies={BUDGET_SETUP_SMART_STRATEGIES}
          onChange={onChange}
        />,
      );
    });

    const pressables = tree.root.findAllByType(Pressable);
    expect(pressables).toHaveLength(3);

    const text = tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" ");

    expect(text).toContain(BUDGET_SETUP_STRATEGY_COPY.standaard.label);
    expect(text).toContain(BUDGET_SETUP_STRATEGY_COPY.balans.label);
    expect(text).toContain(BUDGET_SETUP_STRATEGY_COPY.bespaarmodus.label);
    expect(text).not.toContain(BUDGET_SETUP_STRATEGY_COPY.handmatig.label);
    expect(text).not.toContain("ACTIEF");

    const activeCard = pressables.find(
      (node) => node.props.accessibilityState?.selected === true,
    );
    expect(activeCard).toBeDefined();
    const activeText = activeCard!
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" ");
    expect(activeText).toContain("Balans");
  });

  it("stuurt selecties door naar de caller", () => {
    let tree!: renderer.ReactTestRenderer;
    const onChange = vi.fn();

    act(() => {
      tree = renderer.create(
        <BudgetSetupStrategySelector
          selectedStrategy="balans"
          visibleStrategies={BUDGET_SETUP_SMART_STRATEGIES}
          onChange={onChange}
        />,
      );
    });

    const pressables = tree.root.findAllByType(Pressable);
    act(() => {
      pressables[2].props.onPress?.();
    });

    expect(onChange).toHaveBeenCalledWith("bespaarmodus");
  });

  it("houdt drie strategieën naast elkaar op normale mobielbreedte", () => {
    const spy = vi.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
      width: 360,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetSetupStrategySelector
          selectedStrategy="balans"
          visibleStrategies={BUDGET_SETUP_SMART_STRATEGIES}
          onChange={() => {}}
        />,
      );
    });

    const scrollViews = tree.root.findAllByType(ScrollView);
    expect(scrollViews).toHaveLength(0);
    expect(tree.root.findAllByType(Pressable)).toHaveLength(3);

    spy.mockRestore();
  });

  it("schakelt op echt smalle schermen over naar een slider", () => {
    const spy = vi.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
      width: 320,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetSetupStrategySelector
          selectedStrategy="balans"
          visibleStrategies={BUDGET_SETUP_SMART_STRATEGIES}
          onChange={() => {}}
        />,
      );
    });

    const scrollViews = tree.root.findAllByType(ScrollView);
    expect(scrollViews).toHaveLength(1);
    expect(scrollViews[0].props.horizontal).toBe(true);
    expect(tree.root.findAllByType(Pressable)).toHaveLength(3);

    spy.mockRestore();
  });

  it("schakelt met vier strategieën sneller over naar een slider", () => {
    const spy = vi.spyOn(ReactNative, "useWindowDimensions").mockReturnValue({
      width: 390,
      height: 800,
      scale: 1,
      fontScale: 1,
    });

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <BudgetSetupStrategySelector
          selectedStrategy="balans"
          visibleStrategies={BUDGET_SETUP_ALL_STRATEGIES}
          onChange={() => {}}
        />,
      );
    });

    const scrollViews = tree.root.findAllByType(ScrollView);
    expect(scrollViews).toHaveLength(1);
    expect(scrollViews[0].props.horizontal).toBe(true);
    expect(tree.root.findAllByType(Pressable)).toHaveLength(4);

    spy.mockRestore();
  });
});
