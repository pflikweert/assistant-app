import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type QueryLogEntry = {
  table: string;
  selects: string[];
  inserts: Record<string, unknown>[];
  updates: Record<string, unknown>[];
  filters: { method: string; args: unknown[] }[];
};

const {
  fromMock,
  rpcMock,
  queryLog,
  responseQueue,
  rpcQueue,
  requireCurrentUserIdMock,
} = vi.hoisted(() => {
  const responseQueue: { data: unknown; error: unknown }[] = [];
  const rpcQueue: { data: unknown; error: unknown }[] = [];
  const queryLog: QueryLogEntry[] = [];

  function nextResponse() {
    return responseQueue.shift() || { data: null, error: null };
  }

  function nextRpcResponse() {
    return rpcQueue.shift() || { data: null, error: null };
  }

  function buildQuery(table: string) {
    const entry: QueryLogEntry = {
      table,
      selects: [],
      inserts: [],
      updates: [],
      filters: [],
    };
    queryLog.push(entry);

    const query: any = {
      select: vi.fn((value: string) => {
        entry.selects.push(value);
        return query;
      }),
      eq: vi.fn((...args: unknown[]) => {
        entry.filters.push({ method: "eq", args });
        return query;
      }),
      order: vi.fn((...args: unknown[]) => {
        entry.filters.push({ method: "order", args });
        return query;
      }),
      insert: vi.fn((payload: Record<string, unknown> | Record<string, unknown>[]) => {
        entry.inserts.push(...(Array.isArray(payload) ? payload : [payload]));
        return query;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        entry.updates.push(payload);
        return query;
      }),
      maybeSingle: vi.fn(() => query),
      single: vi.fn(() => query),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(nextResponse()).then(resolve, reject),
    };

    return query;
  }

  return {
    fromMock: vi.fn((table: string) => buildQuery(table)),
    rpcMock: vi.fn(() => Promise.resolve(nextRpcResponse())),
    queryLog,
    responseQueue,
    rpcQueue,
    requireCurrentUserIdMock: vi.fn(),
  };
});

vi.mock("expo-crypto", () => ({
  default: {
    digestStringAsync: vi.fn(async () => "hash"),
    CryptoDigestAlgorithm: {
      SHA256: "SHA256",
    },
  },
  digestStringAsync: vi.fn(async () => "hash"),
  CryptoDigestAlgorithm: {
    SHA256: "SHA256",
  },
}));

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

let createBankAccount: typeof import("./bank-accounts").createBankAccount;
let updateBankAccount: typeof import("./bank-accounts").updateBankAccount;
let getBankAccountTransactionCount: typeof import("./bank-accounts").getBankAccountTransactionCount;
let deleteBankAccountWithTransactions: typeof import("./bank-accounts").deleteBankAccountWithTransactions;
let listBankAccountBudgetFlags: typeof import("./bank-accounts").listBankAccountBudgetFlags;
let isBankAccountIncludedInBudget: typeof import("./bank-accounts").isBankAccountIncludedInBudget;

describe("bank-accounts budget settings", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({
      createBankAccount,
      updateBankAccount,
      getBankAccountTransactionCount,
      deleteBankAccountWithTransactions,
      listBankAccountBudgetFlags,
      isBankAccountIncludedInBudget,
    } = await import("./bank-accounts"));
    fromMock.mockClear();
    rpcMock.mockClear();
    queryLog.length = 0;
    responseQueue.length = 0;
    rpcQueue.length = 0;
    requireCurrentUserIdMock.mockReset();
    requireCurrentUserIdMock.mockResolvedValue("user-123");
  });

  afterEach(() => {
    responseQueue.length = 0;
    rpcQueue.length = 0;
  });

  it("slaat include_in_budget standaard als true op bij nieuwe rekeningen", async () => {
    responseQueue.push({
      data: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "****9805",
        is_active: true,
        include_in_budget: true,
      },
      error: null,
    });

    const account = await createBankAccount({
      name: "Privérekening",
      accountType: "checking",
      provider: "Rabobank",
      accountNumber: "NL32RABO0386559805",
    });

    expect(queryLog[0]?.table).toBe("bank_accounts");
    expect(queryLog[0]?.inserts[0]?.include_in_budget).toBe(true);
    expect(account.include_in_budget).toBe(true);
  });

  it("kan een nieuwe rekening direct gearchiveerd opslaan", async () => {
    responseQueue.push({
      data: {
        id: "bank-2",
        name: "Extra rekening",
        account_type: "savings",
        provider: "ASN",
        currency: "EUR",
        account_masked: "****1122",
        is_active: false,
        include_in_budget: false,
      },
      error: null,
    });

    const account = await createBankAccount({
      name: "Extra rekening",
      accountType: "savings",
      provider: "ASN",
      accountNumber: "NL12ASNB012341122",
      includeInBudget: false,
      isActive: false,
    });

    expect(queryLog[0]?.table).toBe("bank_accounts");
    expect(queryLog[0]?.inserts[0]).toMatchObject({
      include_in_budget: false,
      is_active: false,
    });
    expect(account.include_in_budget).toBe(false);
    expect(account.is_active).toBe(false);
  });

  it("laadt budget-geschikte rekeningen en herkent uitgesloten rekeningen", async () => {
    responseQueue.push({
      data: [
        {
          id: "bank-1",
          include_in_budget: true,
        },
        {
          id: "bank-2",
          include_in_budget: false,
        },
      ],
      error: null,
    });

    const budgetFlags = await listBankAccountBudgetFlags("user-123");

    expect(queryLog[0]?.table).toBe("bank_accounts");
    expect(queryLog[0]?.selects[0]).toContain("include_in_budget");
    expect(budgetFlags.get("bank-1")).toBe(true);
    expect(budgetFlags.get("bank-2")).toBe(false);
    expect(isBankAccountIncludedInBudget("bank-1", budgetFlags)).toBe(true);
    expect(isBankAccountIncludedInBudget("bank-2", budgetFlags)).toBe(false);
    expect(isBankAccountIncludedInBudget("unknown", budgetFlags)).toBe(true);
  });

  it("werkt een bankrekening bij inclusief budget- en activestatus", async () => {
    responseQueue.push({
      data: {
        id: "bank-1",
        name: "Gezamenlijke rekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "****1234",
        is_active: false,
        include_in_budget: false,
      },
      error: null,
    });

    const account = await updateBankAccount({
      id: "bank-1",
      name: "Gezamenlijke rekening",
      accountType: "checking",
      provider: "Rabobank",
      includeInBudget: false,
      isActive: false,
    });

    expect(queryLog[0]?.table).toBe("bank_accounts");
    expect(queryLog[0]?.updates[0]).toMatchObject({
      name: "Gezamenlijke rekening",
      include_in_budget: false,
      is_active: false,
    });
    expect(account.include_in_budget).toBe(false);
    expect(account.is_active).toBe(false);
  });

  it("kan het aantal gekoppelde transacties van een rekening ophalen", async () => {
    responseQueue.push({
      data: null,
      error: null,
      count: 12,
    });

    const count = await getBankAccountTransactionCount("bank-1");

    expect(queryLog[0]?.table).toBe("transactions");
    expect(queryLog[0]?.selects[0]).toBe("id");
    expect(queryLog[0]?.filters).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["user_id", "user-123"] },
        { method: "eq", args: ["bank_account_id", "bank-1"] },
      ]),
    );
    expect(count).toBe(12);
  });

  it("verwijdert een rekening en gekoppelde transacties via de rpc", async () => {
    rpcQueue.push({
      data: 7,
      error: null,
    });

    const deletedCount = await deleteBankAccountWithTransactions("bank-1");

    expect(rpcMock).toHaveBeenCalledWith("delete_bank_account_with_transactions", {
      target_bank_account_id: "bank-1",
    });
    expect(deletedCount).toBe(7);
  });
});
