import React from "react";
import renderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { Pressable } from "react-native";

import AuthErrorMessage, { getAuthErrorMessage } from "./AuthErrorMessage";

vi.mock("expo-router", () => {
  return {
    Link: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("expo-image", () => ({
  Image: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock("./auth-screen-shell", () => ({
  AuthScreenShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  authScreenStyles: {
    button: {},
    buttonText: {},
    textLink: {},
  },
}));

describe("AuthErrorMessage", () => {
  it("toont juiste foutmelding voor verlopen link", () => {
    expect(getAuthErrorMessage("otp_expired")).toMatch(/verlopen/i);
  });

  it("toont custom error description voor onbekende code", () => {
    expect(getAuthErrorMessage("some_unknown_code", "Testfout")).toMatch(
      /Testfout/,
    );
  });

  it("roept onReset aan bij knopdruk", () => {
    const onReset = vi.fn();
    let tree: renderer.ReactTestRenderer;

    act(() => {
      tree = renderer.create(
        <AuthErrorMessage code="otp_expired" onReset={onReset} />,
      );
    });

    const button = tree!.root.findByType(Pressable);
    act(() => {
      button.props.onPress();
    });

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
