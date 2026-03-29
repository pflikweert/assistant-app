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
  queryLog,
  responseQueue,
  requireCurrentUserIdMock,
  runCategorizationInBackgroundMock,
} = vi.hoisted(() => {
  const responseQueue: { data: unknown; error: unknown }[] = [];
  const queryLog: QueryLogEntry[] = [];

  function nextResponse() {
    return responseQueue.shift() || { data: null, error: null };
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
      gte: vi.fn((...args: unknown[]) => {
        entry.filters.push({ method: "gte", args });
        return query;
      }),
      lte: vi.fn((...args: unknown[]) => {
        entry.filters.push({ method: "lte", args });
        return query;
      }),
      insert: vi.fn((payload: Record<string, unknown> | Record<string, unknown>[]) => {
        entry.inserts.push(...(Array.isArray(payload) ? payload : [payload]));
        return query;
      }),
      upsert: vi.fn((payload: Record<string, unknown> | Record<string, unknown>[]) => {
        entry.inserts.push(...(Array.isArray(payload) ? payload : [payload]));
        return query;
      }),
      update: vi.fn((payload: Record<string, unknown>) => {
        entry.updates.push(payload);
        return query;
      }),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(nextResponse()).then(resolve, reject),
    };

    return query;
  }

  return {
    fromMock: vi.fn((table: string) => buildQuery(table)),
    queryLog,
    responseQueue,
    requireCurrentUserIdMock: vi.fn(),
    runCategorizationInBackgroundMock: vi.fn(),
  };
});

vi.mock("@/services/current-user", () => ({
  requireCurrentUserId: requireCurrentUserIdMock,
}));

vi.mock("@/services/categorization", () => ({
  runCategorizationInBackground: runCategorizationInBackgroundMock,
}));

vi.mock("@/services/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

let buildImportDraft: typeof import("./import-flow-state").buildImportDraft;
let clearCurrentImportRunResult: typeof import("./import-flow-state").clearCurrentImportRunResult;
let getImportFlowSnapshot: typeof import("./import-flow-state").getImportFlowSnapshot;
let getCurrentImportRunResult: typeof import("./import-flow-state").getCurrentImportRunResult;
let linkImportGroupToBankAccount: typeof import("./import-flow-state").linkImportGroupToBankAccount;
let beginImportRun: typeof import("./import-flow-state").beginImportRun;
let clearCurrentImportDraft: typeof import("./import-flow-state").clearCurrentImportDraft;
let setCurrentImportDraft: typeof import("./import-flow-state").setCurrentImportDraft;
let executeImportDraft: typeof import("./import-runner").executeImportDraft;

function makeRow(id: number, amount: number) {
  return {
    date: `2026-03-0${id}`,
    details: `Omschrijving ${id}`,
    counterparty: `Tegenpartij ${id}`,
    amount,
    currency: "EUR",
    type: "tb",
    metadata: {
      IBAN: "NL32RABO0386559805",
      Rekeningnummer: "NL32RABO0386559805",
      Rekening: "NL32RABO0386559805",
    },
    seq: id,
  };
}

function makeRowWithoutAccountHint(id: number, amount: number) {
  return {
    date: `2026-03-0${id}`,
    details: `Omschrijving ${id}`,
    counterparty: `Tegenpartij ${id}`,
    amount,
    currency: "EUR",
    type: "tb",
    metadata: {},
    seq: id,
  };
}

describe("import-runner", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({
      buildImportDraft,
      beginImportRun,
      clearCurrentImportRunResult,
      getImportFlowSnapshot,
      getCurrentImportRunResult,
      linkImportGroupToBankAccount,
      clearCurrentImportDraft,
      setCurrentImportDraft,
    } = await import("./import-flow-state"));
    ({ executeImportDraft } = await import("./import-runner"));
    fromMock.mockClear();
    queryLog.length = 0;
    responseQueue.length = 0;
    requireCurrentUserIdMock.mockReset();
    requireCurrentUserIdMock.mockResolvedValue("user-123");
    runCategorizationInBackgroundMock.mockReset();
    clearCurrentImportDraft();
    clearCurrentImportRunResult();
  });

  afterEach(() => {
    clearCurrentImportDraft();
    clearCurrentImportRunResult();
  });

  it("schrijft nieuwe transacties weg, slaat bestaande dubbels over en start categorisatie", async () => {
    const draft = buildImportDraft("csv", "import.csv", [makeRow(1, -10), makeRow(2, -20)]);
    setCurrentImportDraft(draft);
    const linkedDraft = linkImportGroupToBankAccount({
      groupKey: draft.groups[0].key,
      bankAccount: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
      },
      linkedBy: "manual",
    });

    responseQueue.push({
      data: [
        {
          id: "existing-1",
          date: "2026-03-01",
          amount: -10,
          details: "Andere omschrijving",
          counterparty: "Tegenpartij 1",
          metadata: {},
        },
      ],
      error: null,
    });
    responseQueue.push({
      data: [{ id: "inserted-1" }],
      error: null,
    });

    beginImportRun();
    const result = await executeImportDraft(linkedDraft!);

    expect(result.importedTransactions).toBe(1);
    expect(result.skippedTransactions).toBe(1);
    expect(result.categorizationQueued).toBe(true);
    expect(runCategorizationInBackgroundMock).toHaveBeenCalledWith(
      ["inserted-1"],
      "user-123",
    );
    expect(getCurrentImportRunResult()?.importedTransactions).toBe(1);
    expect(getImportFlowSnapshot().run.status).toBe("completed");
    expect(queryLog[0]?.table).toBe("transactions");
    expect(queryLog[0]?.selects[0]).toContain("id,date,amount,details,counterparty,metadata");
    expect(queryLog[1]?.table).toBe("transactions");
    expect(queryLog[1]?.inserts).toHaveLength(1);
  });

  it("weigert import als een bronrekening nog niet gekoppeld is", async () => {
    const draft = buildImportDraft("pdf", "import.pdf", [makeRow(1, -10)]);

    await expect(executeImportDraft(draft)).rejects.toThrow(
      "Koppel eerst alle rekeningen",
    );
    expect(runCategorizationInBackgroundMock).not.toHaveBeenCalled();
  });

  it("stuurt bron- en interne rekeninginformatie mee in de voortgang", async () => {
    const draft = buildImportDraft("csv", "import.csv", [
      makeRowWithoutAccountHint(1, -10),
      makeRowWithoutAccountHint(2, -20),
    ]);
    setCurrentImportDraft(draft);
    const linkedDraft = linkImportGroupToBankAccount({
      groupKey: draft.groups[0].key,
      bankAccount: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
      },
      linkedBy: "manual",
    });

    responseQueue.push({
      data: [],
      error: null,
    });
    responseQueue.push({
      data: [{ id: "inserted-1" }],
      error: null,
    });

    const progressLog: {
      phase: string;
      sourceAccountLabel?: string | null;
      linkedAccountName?: string | null;
      detail?: string | null;
    }[] = [];

    beginImportRun();
    await executeImportDraft(linkedDraft!, {
      onProgress: (progress) => {
        progressLog.push(progress);
      },
    });

    const writingUpdate = progressLog.find((progress) => progress.phase === "writing");
    expect(writingUpdate).toBeTruthy();
    expect(writingUpdate?.sourceAccountLabel).toBe("Onbekende rekening");
    expect(writingUpdate?.linkedAccountName).toBe("Privérekening");
    expect(writingUpdate?.detail).toContain("Onbekende rekening");
    expect(writingUpdate?.detail).toContain("Privérekening");
  });

  it("eindigt pas op completed nadat de laatste batch is opgeslagen", async () => {
    const draft = buildImportDraft("csv", "import.csv", [makeRow(1, -10)]);
    setCurrentImportDraft(draft);
    const linkedDraft = linkImportGroupToBankAccount({
      groupKey: draft.groups[0].key,
      bankAccount: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
      },
      linkedBy: "manual",
    });

    responseQueue.push({
      data: [],
      error: null,
    });
    responseQueue.push({
      data: [{ id: "inserted-1" }],
      error: null,
    });

    const phases: string[] = [];
    beginImportRun();
    await executeImportDraft(linkedDraft!, {
      onProgress: (progress) => {
        phases.push(progress.phase);
        expect(getImportFlowSnapshot().run.status).not.toBe("completed");
      },
    });

    expect(phases).toContain("preparing");
    expect(phases).toContain("writing");
    expect(getImportFlowSnapshot().run.status).toBe("completed");
    expect(getImportFlowSnapshot().run.result?.importedTransactions).toBe(1);
  });

  it("slaat bestaande import uit een ander bronbestand over bij gelijke datum, bedrag en tegenpartij", async () => {
    const draft = buildImportDraft("pdf", "import.pdf", [makeRow(1, -10)]);
    setCurrentImportDraft(draft);
    const linkedDraft = linkImportGroupToBankAccount({
      groupKey: draft.groups[0].key,
      bankAccount: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
      },
      linkedBy: "manual",
    });

    responseQueue.push({
      data: [
        {
          id: "existing-1",
          date: "2026-03-01",
          amount: -10,
          details: "CSV omschrijving die anders is",
          counterparty: "Tegenpartij 1",
          metadata: {},
        },
      ],
      error: null,
    });

    beginImportRun();
    const result = await executeImportDraft(linkedDraft!);

    expect(result.importedTransactions).toBe(0);
    expect(result.skippedTransactions).toBe(1);
    expect(result.categorizationQueued).toBe(false);
    expect(queryLog).toHaveLength(1);
    expect(runCategorizationInBackgroundMock).not.toHaveBeenCalled();
  });

  it("werkt bestaande transacties bij als nieuwe import rijkere details aanlevert", async () => {
    const draft = buildImportDraft("pdf", "import.pdf", [makeRow(1, -10)]);
    setCurrentImportDraft(draft);
    const linkedDraft = linkImportGroupToBankAccount({
      groupKey: draft.groups[0].key,
      bankAccount: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
      },
      linkedBy: "manual",
    });

    linkedDraft!.groups[0]!.transactions[0]!.counterparty = "Unive Dichtbij Advies B.V.";
    linkedDraft!.groups[0]!.transactions[0]!.details =
      "NL46ZZZ321186890000 | Unive Premie 01-03-2026 / 31-03-2026";
    linkedDraft!.groups[0]!.transactions[0]!.metadata = {
      "Transactiereferentie": "5000000064329465",
      "Kenmerk machtiging / incassant ID": "32805-13022404",
    };

    responseQueue.push({
      data: [
        {
          id: "existing-1",
          date: "2026-03-01",
          amount: -10,
          details: "Unive Dichtbij Advies B.V.",
          counterparty: "Unive Dichtbij Advies B.V.",
          metadata: {},
        },
      ],
      error: null,
    });
    responseQueue.push({
      data: [],
      error: null,
    });

    beginImportRun();
    const result = await executeImportDraft(linkedDraft!);

    expect(result.importedTransactions).toBe(1);
    expect(result.skippedTransactions).toBe(0);
    expect(result.categorizationQueued).toBe(true);
    expect(queryLog).toHaveLength(2);
    expect(queryLog[1]?.updates).toHaveLength(1);
    expect(queryLog[1]?.updates[0]).toMatchObject({
      details: "NL46ZZZ321186890000 | Unive Premie 01-03-2026 / 31-03-2026",
      metadata: {
        "Transactiereferentie": "5000000064329465",
        "Kenmerk machtiging / incassant ID": "32805-13022404",
      },
    });
    expect(runCategorizationInBackgroundMock).toHaveBeenCalledWith(
      ["existing-1"],
      "user-123",
    );
  });

  it("behoudt bestaande rijkere omschrijving als PDF een armere variant aanlevert", async () => {
    const draft = buildImportDraft("pdf", "import.pdf", [makeRow(1, -10)]);
    setCurrentImportDraft(draft);
    const linkedDraft = linkImportGroupToBankAccount({
      groupKey: draft.groups[0].key,
      bankAccount: {
        id: "bank-1",
        name: "Privérekening",
        account_type: "checking",
        provider: "Rabobank",
        currency: "EUR",
        account_masked: "********9805",
        is_active: true,
      },
      linkedBy: "manual",
    });

    linkedDraft!.groups[0]!.transactions[0]!.counterparty = "BELASTINGDIENST";
    linkedDraft!.groups[0]!.transactions[0]!.details = "MEER INFO WWW.BELASTINGDIENST.NL";
    linkedDraft!.groups[0]!.transactions[0]!.metadata = {
      Transactiereferentie: "IOAXX54a1910d705d441fb8262cc8a01f86",
      "Kenmerk machtiging / incassant ID": "3065082",
    };

    responseQueue.push({
      data: [
        {
          id: "existing-2",
          date: "2026-03-01",
          amount: -10,
          details:
            "86-STD-4 LET OP, NIEUW TARIEF 28-02-2026 t/m 27-03-2026 MEER INFO WWW.BELASTINGDIENST.NL",
          counterparty: "BELASTINGDIENST",
          metadata: {
            source: "csv",
            Transactiereferentie: "IOAXX54a1910d705d441fb8262cc8a01f86",
          },
        },
      ],
      error: null,
    });
    responseQueue.push({
      data: [],
      error: null,
    });

    beginImportRun();
    const result = await executeImportDraft(linkedDraft!);

    expect(result.importedTransactions).toBe(1);
    expect(result.skippedTransactions).toBe(0);
    expect(result.categorizationQueued).toBe(true);
    expect(queryLog[1]?.updates).toHaveLength(1);
    expect(queryLog[1]?.updates[0]).not.toHaveProperty("details");
    expect(queryLog[1]?.updates[0]).toMatchObject({
      metadata: {
        source: "csv",
        Transactiereferentie: "IOAXX54a1910d705d441fb8262cc8a01f86",
        "Kenmerk machtiging / incassant ID": "3065082",
      },
    });
    expect(runCategorizationInBackgroundMock).toHaveBeenCalledWith(
      ["existing-2"],
      "user-123",
    );
  });
});
