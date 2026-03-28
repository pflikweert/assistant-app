import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it } from "vitest";

import { FinTokens } from "@/constants/theme";
import { FinanceText } from "./finance-text";

function flattenStyle(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (Array.isArray(input)) {
    return input.reduce<Record<string, unknown>>((acc, value) => {
      Object.assign(acc, flattenStyle(value));
      return acc;
    }, {});
  }
  if (typeof input === "object") {
    return input as Record<string, unknown>;
  }
  return {};
}

describe("FinanceText", () => {
  it("gebruikt het variant-contract uit FinTokens.typography", () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FinanceText variant="h2" tone="muted" weight="black">
          Titel
        </FinanceText>,
      );
    });

    const textNode = tree.root.findByType(Text);
    const style = flattenStyle(textNode.props.style);
    expect(style.fontSize).toBe(FinTokens.typography.h2.fontSize);
    expect(style.lineHeight).toBe(FinTokens.typography.h2.lineHeight);
    expect(style.letterSpacing).toBe(FinTokens.typography.h2.letterSpacing);
    expect(style.color).toBe(FinTokens.color.textMuted);
    expect(style.fontWeight).toBe(FinTokens.fontWeight.black);
  });
});
