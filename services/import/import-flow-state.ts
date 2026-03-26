import React from "react";

import type { BankAccount } from "@/services/bank-accounts";

import type { ImportSource, TransactionImportRecord } from "./transaction-import-parser";

export type ImportPreviewRow = {
  date: string;
  description: string;
  amount: string;
};

export type ImportLinkedBankAccount = Pick<
  BankAccount,
  | "id"
  | "name"
  | "account_type"
  | "provider"
  | "currency"
  | "account_masked"
  | "is_active"
  | "include_in_budget"
>;

export type ImportAccountGroup = {
  key: string;
  providerLabel: string;
  sourceAccountNumber: string | null;
  sourceAccountMasked: string | null;
  sourceAccountLabel: string;
  transactionCount: number;
  transactions: TransactionImportRecord[];
  linkedBankAccount: ImportLinkedBankAccount | null;
  linkedBy: "auto" | "manual" | null;
};

export type ImportDraftSummary = {
  source: ImportSource;
  sourceLabel: string;
  totalTransactions: number;
  foundAccounts: number;
  periodLabel: string;
  previewRows: ImportPreviewRow[];
  fileName: string | null;
};

export type ImportDraft = {
  source: ImportSource;
  fileName: string | null;
  rows: TransactionImportRecord[];
  groups: ImportAccountGroup[];
  summary: ImportDraftSummary;
  createdAt: number;
};

export type ImportRunProgress = {
  phase: "preparing" | "writing";
  message: string;
  detail?: string | null;
  savedCount?: number;
  skippedCount?: number;
  totalCount?: number;
  batchNumber?: number;
  batchTotal?: number;
  batchSize?: number;
  sourceAccountLabel?: string | null;
  linkedAccountName?: string | null;
  linkedAccountLine?: string | null;
  linkedBy?: "auto" | "manual" | null;
};

export type ImportRunResult = {
  sourceLabel: string;
  fileName: string | null;
  totalTransactions: number;
  importedTransactions: number;
  skippedTransactions: number;
  linkedAccounts: number;
  periodLabel: string;
  categorizationQueued: boolean;
  completedAt: string;
};

export type ImportRunStatus =
  | "idle"
  | "preparing"
  | "writing"
  | "completed"
  | "error";

export type ImportRunState = {
  status: ImportRunStatus;
  progress: ImportRunProgress | null;
  result: ImportRunResult | null;
  errorMessage: string | null;
  startedAt: number | null;
  completedAt: number | null;
};

export type ImportFlowState = {
  draft: ImportDraft | null;
  run: ImportRunState;
};

const ACCOUNT_HINT_KEYS = [
  "IBAN",
  "IBAN/BBAN",
  "IBAN / BBAN",
  "Rekeningnummer",
  "Rekening nummer",
  "Rekening IBAN/BBAN",
  "Rekening IBAN / BBAN",
  "Rekening",
];

const SOURCE_PROVIDER_LABEL = "Rabobank";
const listeners = new Set<() => void>();

function createInitialImportRunState(): ImportRunState {
  return {
    status: "idle",
    progress: null,
    result: null,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
  };
}

function createInitialImportFlowState(): ImportFlowState {
  return {
    draft: null,
    run: createInitialImportRunState(),
  };
}

let currentImportFlowState: ImportFlowState = createInitialImportFlowState();

function emit() {
  for (const listener of listeners) listener();
}

function updateImportFlowState(
  updater:
    | ImportFlowState
    | Partial<ImportFlowState>
    | ((current: ImportFlowState) => ImportFlowState),
) {
  currentImportFlowState =
    typeof updater === "function"
      ? updater(currentImportFlowState)
      : {
          ...currentImportFlowState,
          ...updater,
        };
  emit();
  return currentImportFlowState;
}

function normalizeAccountNumber(value?: string | null): string | null {
  if (!value) return null;
  const normalized = String(value)
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
  return normalized || null;
}

function maskAccountNumber(value: string): string {
  const length = value.length;
  if (length <= 4) {
    return "*".repeat(length);
  }
  return `${"*".repeat(length - 4)}${value.slice(-4)}`;
}

function formatDateLabel(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function resolvePeriodLabel(rows: TransactionImportRecord[]): string {
  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  if (!dates.length) return "Niet bekend";
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === last) return formatDateLabel(first);
  return `${formatDateLabel(first)} t/m ${formatDateLabel(last)}`;
}

function extractSourceAccountNumber(
  record: TransactionImportRecord,
): string | null {
  for (const key of ACCOUNT_HINT_KEYS) {
    const candidate = normalizeAccountNumber(record.metadata[key] || "");
    if (candidate && candidate.length >= 8) {
      return candidate;
    }
  }
  return null;
}

function buildSourceAccountLabel(accountNumber: string | null): string {
  if (!accountNumber) {
    return "Onbekende rekening";
  }
  return `Rekening ${maskAccountNumber(accountNumber)}`;
}

function buildPreviewRows(rows: TransactionImportRecord[]): ImportPreviewRow[] {
  return rows.slice(0, 5).map((row) => ({
    date: row.date || "—",
    description: row.details || row.counterparty || "—",
    amount: Number.isFinite(row.amount) ? String(row.amount) : "—",
  }));
}

export function subscribeImportFlowState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getImportFlowSnapshot() {
  return currentImportFlowState;
}

export function useImportFlowState() {
  return React.useSyncExternalStore(
    subscribeImportFlowState,
    getImportFlowSnapshot,
    getImportFlowSnapshot,
  );
}

export function buildImportAccountGroups(
  rows: TransactionImportRecord[],
): ImportAccountGroup[] {
  const groups = new Map<string, ImportAccountGroup>();
  const orderedGroups: ImportAccountGroup[] = [];

  rows.forEach((row) => {
    const sourceAccountNumber = extractSourceAccountNumber(row);
    const key = sourceAccountNumber || "unknown";
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        providerLabel: SOURCE_PROVIDER_LABEL,
        sourceAccountNumber,
        sourceAccountMasked: sourceAccountNumber
          ? maskAccountNumber(sourceAccountNumber)
          : null,
        sourceAccountLabel: buildSourceAccountLabel(sourceAccountNumber),
        transactionCount: 0,
        transactions: [],
        linkedBankAccount: null,
        linkedBy: null,
      };
      groups.set(key, group);
      orderedGroups.push(group);
    }

    group.transactions.push(row);
    group.transactionCount += 1;
  });

  return orderedGroups;
}

export function buildImportDraft(
  source: ImportSource,
  fileName: string | null,
  rows: TransactionImportRecord[],
): ImportDraft {
  const groups = buildImportAccountGroups(rows);

  return {
    source,
    fileName,
    rows,
    groups,
    summary: {
      source,
      sourceLabel: source === "pdf" ? "Rabobank PDF" : "Rabobank CSV",
      totalTransactions: rows.length,
      foundAccounts: groups.length,
      periodLabel: resolvePeriodLabel(rows),
      previewRows: buildPreviewRows(rows),
      fileName,
    },
    createdAt: Date.now(),
  };
}

export function getCurrentImportDraft(): ImportDraft | null {
  return currentImportFlowState.draft;
}

export function setCurrentImportDraft(draft: ImportDraft | null): ImportDraft | null {
  updateImportFlowState((current) => ({
    ...current,
    draft,
  }));
  return currentImportFlowState.draft;
}

export function clearCurrentImportDraft(): ImportDraft | null {
  updateImportFlowState((current) => ({
    ...current,
    draft: null,
  }));
  return currentImportFlowState.draft;
}

export function getCurrentImportRunResult(): ImportRunResult | null {
  return currentImportFlowState.run.result;
}

export function setCurrentImportRunResult(
  result: ImportRunResult | null,
): ImportRunResult | null {
  if (!result) {
    clearCurrentImportRunResult();
    return currentImportFlowState.run.result;
  }

  updateImportFlowState((current) => ({
    ...current,
    run: {
      ...current.run,
      status: "completed",
      result,
      errorMessage: null,
      completedAt: Date.now(),
    },
  }));
  return currentImportFlowState.run.result;
}

export function clearCurrentImportRunResult(): ImportRunResult | null {
  updateImportFlowState((current) => ({
    ...current,
    run: createInitialImportRunState(),
  }));
  return currentImportFlowState.run.result;
}

export function updateCurrentImportDraft(
  updater: (draft: ImportDraft | null) => ImportDraft | null,
): ImportDraft | null {
  updateImportFlowState((current) => ({
    ...current,
    draft: updater(current.draft),
  }));
  return currentImportFlowState.draft;
}

export function beginImportRun() {
  if (currentImportFlowState.run.status !== "idle") {
    return false;
  }

  updateImportFlowState((current) => ({
    ...current,
    run: {
      status: "preparing",
      progress: {
        phase: "preparing",
        message: "Transacties worden klaargezet…",
        detail: "We starten het inlezen nu.",
        savedCount: 0,
        skippedCount: 0,
        totalCount: current.draft?.summary.totalTransactions,
      },
      result: null,
      errorMessage: null,
      startedAt: Date.now(),
      completedAt: null,
    },
  }));
  return true;
}

export function setImportRunProgress(progress: ImportRunProgress) {
  updateImportFlowState((current) => ({
    ...current,
    run: {
      ...current.run,
      status: progress.phase,
      progress,
      result: null,
      errorMessage: null,
      startedAt: current.run.startedAt || Date.now(),
    },
  }));
  return currentImportFlowState.run.progress;
}

export function setImportRunError(message: string) {
  updateImportFlowState((current) => ({
    ...current,
    run: {
      ...current.run,
      status: "error",
      errorMessage: message,
      result: null,
      completedAt: null,
    },
  }));
  return currentImportFlowState.run.errorMessage;
}

export function resetImportRun() {
  return clearCurrentImportRunResult();
}

export function linkImportGroupToBankAccount(input: {
  groupKey: string;
  bankAccount: ImportLinkedBankAccount;
  linkedBy: "auto" | "manual";
}): ImportDraft | null {
  return updateCurrentImportDraft((draft) => {
    if (!draft) return draft;

    return {
      ...draft,
      groups: draft.groups.map((group) =>
        group.key === input.groupKey
          ? {
              ...group,
              linkedBankAccount: input.bankAccount,
              linkedBy: input.linkedBy,
            }
          : group,
      ),
    };
  });
}

export function unlinkImportGroup(groupKey: string): ImportDraft | null {
  return updateCurrentImportDraft((draft) => {
    if (!draft) return draft;

    return {
      ...draft,
      groups: draft.groups.map((group) =>
        group.key === groupKey
          ? {
              ...group,
              linkedBankAccount: null,
              linkedBy: null,
            }
          : group,
      ),
    };
  });
}
