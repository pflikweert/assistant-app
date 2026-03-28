import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  repoMock,
  enrichTransactionAnalysisMock,
  requestForecastRefreshMock,
  postOpenAIChatCompletionMock,
  listBankAccountHashesMock,
} = vi.hoisted(() => ({
  repoMock: {
    getCategories: vi.fn(),
    getActiveRules: vi.fn(),
    getTransactionsByIds: vi.fn(),
    updateAutoCategory: vi.fn(),
    insertAudit: vi.fn(),
    incrementRuleHit: vi.fn(),
    clearAutoCategories: vi.fn(),
  },
  enrichTransactionAnalysisMock: vi.fn(),
  requestForecastRefreshMock: vi.fn(),
  postOpenAIChatCompletionMock: vi.fn(),
  listBankAccountHashesMock: vi.fn(),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        OPENAI_MODEL: "gpt-4.1-mini",
      },
    },
  },
}));

vi.mock("./analysis", () => ({
  enrichTransactionAnalysis: enrichTransactionAnalysisMock,
}));

vi.mock("./categorization-repository", () => ({
  createSupabaseCategorizationRepository: vi.fn(() => repoMock),
  normalizePattern: (value: string) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
}));

vi.mock("./category-display", () => ({
  getLeafCategories: (categories: any[]) => categories,
}));

vi.mock("./forecast-refresh", () => ({
  requestForecastRefresh: requestForecastRefreshMock,
}));

vi.mock("./openai-proxy", () => ({
  postOpenAIChatCompletion: postOpenAIChatCompletionMock,
}));

vi.mock("./own-account-transfer-heuristics", () => ({
  resolveOwnAccountTransferHeuristicMatch: vi.fn(async () => null),
}));

vi.mock("./bank-accounts", () => ({
  listBankAccountHashes: listBankAccountHashesMock,
}));

let categorizeTransactions: typeof import("./categorization").categorizeTransactions;

describe("categorization two-phase flow", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ categorizeTransactions } = await import("./categorization"));

    repoMock.getCategories.mockReset();
    repoMock.getActiveRules.mockReset();
    repoMock.getTransactionsByIds.mockReset();
    repoMock.updateAutoCategory.mockReset();
    repoMock.insertAudit.mockReset();
    repoMock.incrementRuleHit.mockReset();
    repoMock.clearAutoCategories.mockReset();
    enrichTransactionAnalysisMock.mockReset();
    requestForecastRefreshMock.mockReset();
    postOpenAIChatCompletionMock.mockReset();
    listBankAccountHashesMock.mockReset();

    listBankAccountHashesMock.mockResolvedValue([]);
    enrichTransactionAnalysisMock.mockResolvedValue({
      scanned: 1,
      updated: 1,
      incomeSourcesUpserted: 0,
    });
    requestForecastRefreshMock.mockResolvedValue(undefined);
  });

  it("routes low-confidence rule candidates to OpenAI in phase 2", async () => {
    repoMock.getCategories.mockResolvedValue([
      { id: "cat-food", key: "food", name: "Boodschappen" },
    ]);
    repoMock.getActiveRules.mockResolvedValue([
      {
        id: "rule-low",
        category_id: "cat-food",
        pattern: "Jumbo",
        pattern_normalized: "jumbo",
        pattern_type: "counterparty_contains",
        confidence: 0.6,
        hit_count: 0,
        is_active: true,
        is_system: false,
        scope: "user",
        user_id: "user-1",
      },
    ]);
    repoMock.getTransactionsByIds.mockResolvedValue([
      {
        id: "tx-1",
        details: "Betaalpas | Jumbo",
        counterparty: "Jumbo",
        amount: -42.5,
        date: "2026-03-10",
        metadata: {},
        category_id_auto: null,
        category_id_user: null,
      },
    ]);
    postOpenAIChatCompletionMock.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => ({
        choices: [
          {
            finish_reason: "stop",
            message: {
              content: JSON.stringify({
                items: [
                  {
                    id: "tx-1",
                    category_key: "food",
                    confidence: 0.91,
                    reason: "Patroon past bij boodschappen.",
                  },
                ],
              }),
            },
          },
        ],
      }),
      text: async () => "",
    });

    const summary = await categorizeTransactions(["tx-1"], {
      scheduleForecastRefresh: false,
    });

    expect(summary).toMatchObject({
      considered: 1,
      updated: 1,
      rule: 0,
      openai: 1,
      skipped: 0,
      cleared: 0,
    });
    expect(postOpenAIChatCompletionMock).toHaveBeenCalledTimes(1);
    expect(repoMock.updateAutoCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "tx-1",
        categoryId: "cat-food",
        source: "openai",
      }),
    );
    expect(enrichTransactionAnalysisMock).toHaveBeenCalledWith(["tx-1"]);
  });
});
