import { afterEach, describe, expect, it } from "vitest";

import {
  beginImportRun,
  buildImportDraft,
  clearCurrentImportDraft,
  clearCurrentImportRunResult,
  getImportFlowSnapshot,
  getCurrentImportDraft,
  linkImportGroupToBankAccount,
  setCurrentImportRunResult,
  setCurrentImportDraft,
  subscribeImportFlowState,
} from "./import-flow-state";
import type { TransactionImportRecord } from "./transaction-import-parser";

function makeRow(
  id: number,
  iban: string,
  amount: number,
): TransactionImportRecord {
  return {
    date: `2026-03-0${id}`,
    details: `Omschrijving ${id}`,
    counterparty: `Tegenpartij ${id}`,
    amount,
    currency: "EUR",
    type: "tb",
    metadata: {
      IBAN: iban,
      Rekeningnummer: iban,
      Rekening: iban,
    },
    seq: id,
  };
}

function maskAccountNumber(value: string): string {
  if (value.length <= 4) {
    return "*".repeat(value.length);
  }
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

describe("import-flow-state", () => {
  afterEach(() => {
    clearCurrentImportDraft();
    clearCurrentImportRunResult();
  });

  it("groepeert bronrekeningen en bouwt een samenvatting", () => {
    const ibanA = "NL32RABO0386559805";
    const ibanB = "NL08BUNQ2156637393";
    const draft = buildImportDraft("csv", "import.csv", [
      makeRow(1, ibanA, -10),
      makeRow(2, ibanA, -20),
      makeRow(3, ibanB, 30),
    ]);

    expect(draft.summary.sourceLabel).toBe("Rabobank CSV");
    expect(draft.summary.totalTransactions).toBe(3);
    expect(draft.summary.foundAccounts).toBe(2);
    expect(draft.summary.previewRows).toHaveLength(3);
    expect(draft.groups).toHaveLength(2);
    expect(draft.groups[0]).toMatchObject({
      sourceAccountNumber: ibanA,
      sourceAccountMasked: maskAccountNumber(ibanA),
      transactionCount: 2,
    });
    expect(draft.groups[1]).toMatchObject({
      sourceAccountNumber: ibanB,
      sourceAccountMasked: maskAccountNumber(ibanB),
      transactionCount: 1,
    });
  });

  it("herkent csv bronrekening ook als IBAN/BBAN-kolom wordt gebruikt", () => {
    const iban = "NL32RABO0386559805";
    const draft = buildImportDraft("csv", "import.csv", [
      {
        ...makeRow(1, "", -10),
        metadata: {
          "IBAN/BBAN": iban,
        },
      },
    ]);

    expect(draft.groups).toHaveLength(1);
    expect(draft.groups[0]?.sourceAccountNumber).toBe(iban);
    expect(draft.groups[0]?.sourceAccountMasked).toBe(maskAccountNumber(iban));
  });

  it("houdt de gedeelde importdraft gekoppeld aan een interne bankrekening", () => {
    const draft = buildImportDraft("pdf", "import.pdf", [
      makeRow(1, "NL32RABO0386559805", -10),
    ]);
    setCurrentImportDraft(draft);

    const nextDraft = linkImportGroupToBankAccount({
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

    expect(nextDraft?.groups[0].linkedBankAccount?.id).toBe("bank-1");
    expect(nextDraft?.groups[0].linkedBy).toBe("manual");
    expect(getCurrentImportDraft()?.groups[0].linkedBankAccount?.name).toBe("Privérekening");
  });

  it("notificeert subscribers bij draft- en run-updates", () => {
    const calls: {
      draftPresent: boolean;
      runStatus: string;
      hasResult: boolean;
    }[] = [];
    const unsubscribe = subscribeImportFlowState(() => {
      const snapshot = getImportFlowSnapshot();
      calls.push({
        draftPresent: Boolean(snapshot.draft),
        runStatus: snapshot.run.status,
        hasResult: Boolean(snapshot.run.result),
      });
    });

    const draft = buildImportDraft("csv", "import.csv", [
      makeRow(1, "NL32RABO0386559805", -10),
    ]);

    setCurrentImportDraft(draft);
    expect(beginImportRun()).toBe(true);
    setCurrentImportRunResult({
      sourceLabel: "Rabobank CSV",
      fileName: "import.csv",
      totalTransactions: 1,
      importedTransactions: 1,
      skippedTransactions: 0,
      linkedAccounts: 1,
      periodLabel: "1 mrt 2026",
      categorizationQueued: true,
      completedAt: new Date().toISOString(),
    });

    unsubscribe();

    expect(calls).toEqual([
      { draftPresent: true, runStatus: "idle", hasResult: false },
      { draftPresent: true, runStatus: "preparing", hasResult: false },
      { draftPresent: true, runStatus: "completed", hasResult: true },
    ]);
  });
});
