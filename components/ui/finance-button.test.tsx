import React from "react";
import renderer, { act } from "react-test-renderer";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { FinanceButton } from "./finance-button";

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

describe("FinanceButton", () => {
  it("toont label en ondersteunt icon slots", () => {
    const onPress = vi.fn();
    let tree!: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <FinanceButton
          label="Opslaan"
          onPress={onPress}
          leftIcon={<Text>L</Text>}
          rightIcon={<Text>R</Text>}
        />,
      );
    });

    const text = tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" ");
    expect(text).toContain("Opslaan");
    expect(text).toContain("L");
    expect(text).toContain("R");
  });

  it("toont loading state en disablet interactie", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FinanceButton label="Opslaan" onPress={() => {}} loading />,
      );
    });

    const pressable = tree.root.findByType(Pressable);
    expect(pressable.props.disabled).toBe(true);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBe(1);
  });
});
