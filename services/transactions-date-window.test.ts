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

  it("supports searching by category ids and signed amounts", async () => {
    rangeMock.mockResolvedValueOnce({
      data: [{ id: "tx-amount", date: "2026-03-20" }],
      error: null,
      count: 1,
    });

    await fetchTransactionsDateWindow({
      select: "id,date,amount",
      fromDateInclusive: "2026-03-01",
      toDateExclusive: "2026-04-01",
      searchQuery: "+12,50 huur",
      searchCategoryIdCsv: "cat-1,cat-2",
      limit: 20,
      offset: 0,
    });

    const lastOrCall = orMock.mock.calls.at(-1)?.[0] as string;
    expect(lastOrCall).toContain("category_id_user.in.(cat-1,cat-2)");
    expect(lastOrCall).toContain("amount.eq.12.5");
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
