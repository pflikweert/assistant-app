/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { repoMock, getTransactionDetailMock, requestForecastRefreshMock } = vi.hoisted(
  () => ({
    repoMock: {
      getCategories: vi.fn(),
      getActiveRules: vi.fn(),
      getTransactionsByIds: vi.fn(),
      setCategoryRuleActive: vi.fn(),
      clearAutoCategories: vi.fn(),
    },
    getTransactionDetailMock: vi.fn(),
    requestForecastRefreshMock: vi.fn(),
  }),
);

vi.mock("./categorization-repository", () => ({
  createSupabaseCategorizationRepository: vi.fn(() => repoMock),
  getTransactionDetail: getTransactionDetailMock,
  normalizePattern: (value: string) =>
    String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
}));

vi.mock("./forecast-refresh", () => ({
  requestForecastRefresh: requestForecastRefreshMock,
}));

import {
  getTransactionRuleMatch,
  resetTransactionRuleMatch,
} from "./transaction-rule-management";

describe("transaction-rule-management", () => {
  beforeEach(() => {
    repoMock.getCategories.mockReset();
    repoMock.getActiveRules.mockReset();
    repoMock.getTransactionsByIds.mockReset();
    repoMock.setCategoryRuleActive.mockReset();
    repoMock.clearAutoCategories.mockReset();
    getTransactionDetailMock.mockReset();
    requestForecastRefreshMock.mockReset();
  });

  it("finds the active rule for the transaction", async () => {
    repoMock.getCategories.mockResolvedValue([
      { id: "cat-food", key: "food", name: "Boodschappen" },
    ]);
    repoMock.getActiveRules.mockResolvedValue([
      {
        id: "rule-1",
        category_id: "cat-food",
        pattern: "Jumbo",
        pattern_normalized: "jumbo",
        pattern_type: "counterparty_contains",
        confidence: 0.95,
        hit_count: 3,
        is_active: true,
        scope: "user",
        user_id: "user-1",
      },
    ]);
    repoMock.getTransactionsByIds.mockResolvedValue([
      {
        id: "tx-1",
        counterparty: "Jumbo Supermarkten",
        details: "Betaalpas | Jumbo Supermarkten |",
        amount: -42.5,
        date: "2026-03-12",
        category_id_auto: "cat-food",
        category_id_user: null,
      },
    ]);

    await expect(getTransactionRuleMatch("tx-1")).resolves.toMatchObject({
      ruleId: "rule-1",
      categoryId: "cat-food",
      categoryKey: "food",
      categoryName: "Boodschappen",
      pattern: "Jumbo",
      patternType: "counterparty_contains",
      confidence: 0.95,
      scope: "user",
      userId: "user-1",
    });
  });

  it("deactivates the rule and clears the auto category when resetting", async () => {
    repoMock.getCategories.mockResolvedValue([
      { id: "cat-food", key: "food", name: "Boodschappen" },
    ]);
    repoMock.getActiveRules.mockResolvedValue([
      {
        id: "rule-1",
        category_id: "cat-food",
        pattern: "Jumbo",
        pattern_normalized: "jumbo",
        pattern_type: "counterparty_contains",
        confidence: 0.95,
        hit_count: 3,
        is_active: true,
        scope: "user",
        user_id: "user-1",
      },
    ]);
    repoMock.getTransactionsByIds.mockResolvedValue([
      {
        id: "tx-1",
        counterparty: "Jumbo Supermarkten",
        details: "Betaalpas | Jumbo Supermarkten |",
        amount: -42.5,
        date: "2026-03-12",
        category_id_auto: "cat-food",
        category_id_user: null,
        category_source: "rule",
      },
    ]);
    getTransactionDetailMock.mockResolvedValue({
      id: "tx-1",
      date: "2026-03-12",
      details: "Betaalpas | Jumbo Supermarkten |",
      counterparty: "Jumbo Supermarkten",
      amount: -42.5,
      currency: "EUR",
      type: "debit",
      metadata: {},
      category_id_auto: "cat-food",
      category_id_user: null,
      category_confidence: 0.95,
      category_source: "rule",
      category_model: "rule",
      categorized_at: "2026-03-12T10:00:00.000Z",
      created_at: "2026-03-12T09:59:00.000Z",
      is_reviewed: false,
      budget_excluded: false,
    });
    repoMock.setCategoryRuleActive.mockResolvedValue(undefined);
    repoMock.clearAutoCategories.mockResolvedValue(undefined);
    requestForecastRefreshMock.mockResolvedValue(undefined);

    await expect(resetTransactionRuleMatch("tx-1")).resolves.toBe(true);
    expect(repoMock.setCategoryRuleActive).toHaveBeenCalledWith("rule-1", false);
    expect(repoMock.clearAutoCategories).toHaveBeenCalledWith(["tx-1"]);
    expect(requestForecastRefreshMock).toHaveBeenCalledWith({
      reason: "manual_category",
      delayMs: 5000,
    });
  });
});
