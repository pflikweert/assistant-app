/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  recategorizeSingleTransactionMock,
  setAutoCategoryMock,
  insertAuditMock,
  requestForecastRefreshMock,
} = vi.hoisted(() => ({
  recategorizeSingleTransactionMock: vi.fn(),
  setAutoCategoryMock: vi.fn(),
  insertAuditMock: vi.fn(),
  requestForecastRefreshMock: vi.fn(),
}));

vi.mock("./categorization", () => ({
  recategorizeSingleTransaction: recategorizeSingleTransactionMock,
}));

vi.mock("./categorization-repository", () => ({
  createSupabaseCategorizationRepository: vi.fn(() => ({
    setAutoCategory: setAutoCategoryMock,
    insertAudit: insertAuditMock,
  })),
}));

vi.mock("./forecast-refresh", () => ({
  requestForecastRefresh: requestForecastRefreshMock,
}));

import { recategorizeTransactionWithAI } from "./transaction-ai-categorization";

describe("recategorizeTransactionWithAI", () => {
  beforeEach(() => {
    recategorizeSingleTransactionMock.mockReset();
    setAutoCategoryMock.mockReset();
    insertAuditMock.mockReset();
    requestForecastRefreshMock.mockReset();
  });

  it("persists the AI category and audit entry", async () => {
    recategorizeSingleTransactionMock.mockResolvedValue({
      categoryId: "cat-food",
      categoryKey: "food",
      categoryName: "Boodschappen",
      confidence: 0.93,
      reason: "Past bij de winkelomzet.",
      model: "gpt-4.1-mini",
    });
    setAutoCategoryMock.mockResolvedValue({
      previousCategoryId: "old-cat",
      counterparty: "Jumbo",
    });
    requestForecastRefreshMock.mockResolvedValue(undefined);

    await expect(recategorizeTransactionWithAI("tx-1")).resolves.toMatchObject({
      categoryId: "cat-food",
      categoryKey: "food",
      categoryName: "Boodschappen",
      confidence: 0.93,
      reason: "Past bij de winkelomzet.",
      model: "gpt-4.1-mini",
    });

    expect(setAutoCategoryMock).toHaveBeenCalledWith(
      "tx-1",
      "cat-food",
      0.93,
      "openai",
      "gpt-4.1-mini",
    );
    expect(insertAuditMock).toHaveBeenCalledWith({
      transactionId: "tx-1",
      previousCategoryId: "old-cat",
      newCategoryId: "cat-food",
      source: "openai",
      model: "gpt-4.1-mini",
      confidence: 0.93,
      reason: "Past bij de winkelomzet.",
    });
    expect(requestForecastRefreshMock).toHaveBeenCalledWith({
      reason: "manual_category",
      delayMs: 5000,
    });
  });

  it("returns null when no prediction is available", async () => {
    recategorizeSingleTransactionMock.mockResolvedValue(null);

    await expect(recategorizeTransactionWithAI("tx-2")).resolves.toBeNull();
    expect(setAutoCategoryMock).not.toHaveBeenCalled();
    expect(insertAuditMock).not.toHaveBeenCalled();
    expect(requestForecastRefreshMock).not.toHaveBeenCalled();
  });
});
