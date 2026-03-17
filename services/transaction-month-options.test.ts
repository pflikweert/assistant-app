import { describe, expect, it, vi } from "vitest";

import {
  getMonthOptionByKey,
  groupMonthOptionsByYear,
  listTransactionMonthOptions,
} from "./transaction-month-options";

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

describe("getMonthOptionByKey", () => {
  it("builds a valid month option from a YYYY-MM key", () => {
    const option = getMonthOptionByKey("2026-03");

    expect(option).not.toBeNull();
    expect(option?.key).toBe("2026-03");
    expect(option?.startIso).toBe("2026-03-01");
    expect(option?.endIso).toBe("2026-04-01");
    expect(option?.year).toBe(2026);
    expect(option?.month).toBe(3);
  });

  it("returns null for invalid month keys", () => {
    expect(getMonthOptionByKey("all")).toBeNull();
    expect(getMonthOptionByKey("2026-13")).toBeNull();
    expect(getMonthOptionByKey("")).toBeNull();
  });
});

describe("groupMonthOptionsByYear", () => {
  it("groups months under the correct year in descending order", () => {
    const options = ["2026-03", "2026-01", "2025-12", "2025-04"]
      .map((key) => getMonthOptionByKey(key))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const grouped = groupMonthOptionsByYear(options);

    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.year).toBe(2026);
    expect(grouped[0]?.months.map((month) => month.key)).toEqual([
      "2026-03",
      "2026-01",
    ]);
    expect(grouped[1]?.year).toBe(2025);
    expect(grouped[1]?.months.map((month) => month.key)).toEqual([
      "2025-12",
      "2025-04",
    ]);
  });
});

describe("listTransactionMonthOptions", () => {
  it("maps RPC month rows to month options in descending order", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ month_start: "2026-03-01" }, { month_start: "2025-12-01" }],
      error: null,
    });

    const options = await listTransactionMonthOptions();

    expect(rpcMock).toHaveBeenCalledWith("list_transaction_months", {
      p_counterparty: null,
    });
    expect(options.map((option) => option.key)).toEqual(["2026-03", "2025-12"]);
  });

  it("passes the counterparty filter to the RPC", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ month_start: "2026-01-01" }],
      error: null,
    });

    const options = await listTransactionMonthOptions({
      counterparty: "Albert Heijn",
    });

    expect(rpcMock).toHaveBeenCalledWith("list_transaction_months", {
      p_counterparty: "Albert Heijn",
    });
    expect(options[0]?.key).toBe("2026-01");
  });
});
