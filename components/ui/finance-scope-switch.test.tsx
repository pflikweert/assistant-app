import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { FinanceScopeSwitch } from "./finance-scope-switch";
import type { MoneyViewScope } from "@/services/finance-scope";

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

describe("FinanceScopeSwitch", () => {
  it("toont de drie scope-opties in de producttaal van het screenshot", () => {
    const onChange = vi.fn();
    const options: MoneyViewScope[] = ["personal", "shared", "household"];

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <FinanceScopeSwitch value="shared" options={options} onChange={onChange} />,
      );
    });

    const text = tree.root
      .findAllByType(Text)
      .flatMap((node) => flattenText(node.props.children))
      .join(" ");

    expect(text).toContain("Persoonlijk");
    expect(text).toContain("Samen");
    expect(text).toContain("Huishouden");
    expect(text).not.toContain("Financiële context");
  });
});
