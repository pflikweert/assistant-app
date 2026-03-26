import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTransactionsDateWindow } from "./transactions-date-window";

const { fromMock, requireCurrentUserIdMock, selectMock, gteMock, ltMock, orMock, rangeMock } =
  vi.hoisted(() => {
    const range = vi.fn();
    const order = vi.fn(() => ({ order, range }));
    const or = vi.fn(() => ({ eq, gte, lt, or, order, range }));
    const lt = vi.fn(() => ({ eq, gte, lt, or, order, range }));
    const gte = vi.fn(() => ({ eq, gte, lt, or, order, range }));
    const eq = vi.fn(() => ({ eq, gte, lt, or, order, range }));
    const select = vi.fn(() => ({ eq, gte, lt, or, order, range }));
    const from = vi.fn(() => ({ select }));
    const requireCurrentUserId = vi.fn(async () => "user-1");
    return {
      fromMock: from,
      requireCurrentUserIdMock: requireCurrentUserId,
      selectMock: select,
      eqMock: eq,
      gteMock: gte,
      ltMock: lt,
      orMock: or,
      orderMock: order,
      rangeMock: range,
    };
  });

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

describe("fetchTransactionsDateWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a date-window query and returns rows with count", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [{ id: "tx-1", date: "2026-03-26" }],
      error: null,
      count: 1,
    });

    const result = await fetchTransactionsDateWindow({
      select: "id,date",
      fromDateInclusive: "2026-03-01",
      toDateExclusive: "2026-04-01",
      searchQuery: "paypal",
      limit: 20,
      offset: 0,
    });

    expect(selectMock).toHaveBeenCalledWith("id,date", { count: "exact" });
    expect(gteMock).toHaveBeenCalledWith("date", "2026-03-01");
    expect(ltMock).toHaveBeenCalledWith("date", "2026-04-01");
    expect(orMock).toHaveBeenCalled();
    expect(result.totalCount).toBe(1);
    expect(result.rows).toHaveLength(1);
  });

  it("collapses identical requests with short TTL cache", async () => {
    rangeMock.mockResolvedValue({
      data: [{ id: "tx-2", date: "2026-03-25" }],
      error: null,
      count: 1,
    });

    const first = await fetchTransactionsDateWindow({
      select: "id,date",
      fromDateInclusive: "2026-03-01",
      toDateExclusive: "2026-04-01",
      limit: 10,
      offset: 0,
    });
    const second = await fetchTransactionsDateWindow({
      select: "id,date",
      fromDateInclusive: "2026-03-01",
      toDateExclusive: "2026-04-01",
      limit: 10,
      offset: 0,
    });

    expect(first.rows[0]?.id).toBe("tx-2");
    expect(second.rows[0]?.id).toBe("tx-2");
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
