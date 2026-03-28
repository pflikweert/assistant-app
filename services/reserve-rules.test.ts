import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, requireCurrentUserIdMock, queryRef } = vi.hoisted(() => {
  const queryRef = {
    result: {
      data: [] as Record<string, unknown>[],
      error: null as unknown,
    },
  };

  const fromMock = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(async () => queryRef.result),
      })),
    })),
  }));

  return {
    fromMock,
    requireCurrentUserIdMock: vi.fn(),
    queryRef,
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

describe("reserve-rules missing relation fallback", () => {
  beforeEach(() => {
    vi.resetModules();
    fromMock.mockClear();
    requireCurrentUserIdMock.mockResolvedValue("user-1");
    queryRef.result = { data: [], error: null };
  });

  it("stopt met herhaald opvragen na relation-miss (404/PGRST205)", async () => {
    const module = await import("./reserve-rules");

    queryRef.result = {
      data: null as any,
      error: { code: "PGRST205", message: "Could not find the table" },
    };
    const first = await module.listAnnualObligationReserveRules({
      includePaused: true,
    });
    expect(first).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);

    queryRef.result = {
      data: [{ id: "unexpected" }],
      error: null,
    };
    const second = await module.listAnnualObligationReserveRules({
      includePaused: true,
    });
    expect(second).toEqual([]);
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
