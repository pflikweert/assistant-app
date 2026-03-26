import React from "react";
import renderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useLocalSearchParamsMock, capturedPropsRef } = vi.hoisted(() => ({
  useLocalSearchParamsMock: vi.fn(),
  capturedPropsRef: { current: null as any },
}));

vi.mock("expo-router", () => ({
  useLocalSearchParams: useLocalSearchParamsMock,
}));

vi.mock("../screens/TransactionsScreen", () => ({
  __esModule: true,
  default: (props: any) => {
    capturedPropsRef.current = props;
    return null;
  },
}));

describe("transactions tab entry", () => {
  beforeEach(() => {
    capturedPropsRef.current = null;
    useLocalSearchParamsMock.mockReset();
  });

  it("geeft bankAccountId door aan TransactionsScreen", async () => {
    const { default: TransactionsTabEntry } = await import("../app/(tabs)/transactions");
    useLocalSearchParamsMock.mockReturnValue({
      bankAccountId: "bank-987",
    });

    act(() => {
      renderer.create(<TransactionsTabEntry />);
    });

    expect(capturedPropsRef.current?.bankAccountIdFilter).toBe("bank-987");
  });

  it("normaliseert array params naar de eerste waarde", async () => {
    const { default: TransactionsTabEntry } = await import("../app/(tabs)/transactions");
    useLocalSearchParamsMock.mockReturnValue({
      bankAccountId: ["bank-main", "bank-alt"],
    });

    act(() => {
      renderer.create(<TransactionsTabEntry />);
    });

    expect(capturedPropsRef.current?.bankAccountIdFilter).toBe("bank-main");
  });
});
