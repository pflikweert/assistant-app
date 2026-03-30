import React from "react";
import renderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";

vi.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) =>
    React.createElement("mock-expo-image", props),
}));

vi.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    createAnimatedComponent: (Component: React.ComponentType<any>) => Component,
  },
  useAnimatedStyle: (factory: () => Record<string, unknown>) => factory(),
}));

vi.mock("./useSplashLoaderAnimation", () => ({
  useSplashLoaderAnimation: () => ({
    phase: { value: 0.25 },
    pulse: { value: 0.98 },
    glow: { value: 0.5 },
  }),
}));

vi.mock("./finance-live-status-dot-motion", () => ({
  FinanceLiveStatusDotMotion: () => React.createElement("mock-status-dot"),
}));

const { SplashLoader } = await import("./SplashLoader");

describe("SplashLoader", () => {
  it("toont de configureerbare splash copy en achtergrondbron", () => {
    const imageSource = { uri: "test://budio-splash" };
    let tree!: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <SplashLoader
          eyebrow="Budio"
          title="Je cockpit komt zo online"
          subtitle="We laden veilige ruimte en komende risico's."
          label="Synchroniseren"
          imageSource={imageSource}
        />,
      );
    });

    const texts = tree.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .filter((value): value is string => typeof value === "string");

    expect(texts).toContain("Budio");
    expect(texts).toContain("Je cockpit komt zo online");
    expect(texts).toContain("We laden veilige ruimte en komende risico's.");
    expect(texts).toContain("Synchroniseren");

    const image = tree.root.findByType("mock-expo-image");
    expect(image.props.source).toBe(imageSource);
  });
});
