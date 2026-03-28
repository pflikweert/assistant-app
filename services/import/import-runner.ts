import { runCategorizationInBackground } from "@/services/categorization";
import { requireCurrentUserId } from "@/services/current-user";
import { supabase } from "@/services/supabase";
import { normalizeTransactionDetails } from "@/services/transaction-details";

import type {
  ImportAccountGroup,
  ImportDraft,
  ImportRunProgress,
  ImportRunResult,
} from "./import-flow-state";
import { setCurrentImportRunResult, setImportRunError, setImportRunProgress } from "./import-flow-state";
import {
  findMatchingImportedTransaction,
  type ImportedTransactionMatchCandidate,
} from "./transaction-import-match";

export type ImportRunPhase = ImportRunProgress["phase"];
export type { ImportRunProgress };

export type ExecuteImportDraftOptions = {
  onProgress?: (progress: ImportRunProgress) => void;
};

type ExistingImportedTransactionCandidate = ImportedTransactionMatchCandidate & {
  date?: string | null;
  amount?: number | null;
};

function emitProgress(
  onProgress: ExecuteImportDraftOptions["onProgress"],
  progress: ImportRunProgress,
) {
  onProgress?.(progress);
}

function getImportDebugFlag(): boolean {
  const raw = process.env.EXPO_PUBLIC_IMPORT_DEBUG;
  if (!raw) return false;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const IMPORT_DEBUG_ENABLED = getImportDebugFlag();

function debugImport(message: string, data?: Record<string, unknown>) {
  if (!IMPORT_DEBUG_ENABLED) return;
  if (data) {
    console.log(`[import-debug] ${message}`, data);
    return;
  }
  console.log(`[import-debug] ${message}`);
}

function normalizeAmountKey(value: number): string {
  return Number(value).toString();
}

function buildTransactionKey(date: string, amount: number, details: string): string {
  return `${date}|${normalizeAmountKey(amount)}|${normalizeTransactionDetails(details)}`;
}

function buildDateAmountKey(date: string, amount: number): string {
  return `${date}|${normalizeAmountKey(amount)}`;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: string }).code || "") === "23505",
  );
}

function assertLinked(
  group: ImportAccountGroup,
): asserts group is ImportAccountGroup & {
  linkedBankAccount: NonNullable<ImportAccountGroup["linkedBankAccount"]>;
} {
  if (!group.linkedBankAccount?.id) {
    throw new Error("Koppel eerst alle rekeningen voordat je verdergaat.");
  }
}

function describeLinkedAccount(group: ImportAccountGroup): {
  name: string;
  line: string;
} | null {
  const linkedAccount = group.linkedBankAccount;
  if (!linkedAccount) return null;

  const parts = [linkedAccount.name];
  if (linkedAccount.provider) {
    parts.push(linkedAccount.provider);
  }
  if (linkedAccount.account_masked) {
    parts.push(linkedAccount.account_masked);
  }

  return {
    name: linkedAccount.name,
    line: parts.join(" · "),
  };
}

async function insertTransactionBatch(batch: Record<string, unknown>[]): Promise<string[]> {
  if (!batch.length) return [];

  const { data, error } = await supabase
    .from("transactions")
    .upsert(batch, {
      onConflict: "user_id,bank_account_id,date,amount,details",
      ignoreDuplicates: true,
    })
    .select("id");

  if (!error) {
    return ((data || []) as { id: string }[]).map((row) => String(row.id || ""));
  }

  if (!isUniqueViolation(error)) {
    throw error;
  }

  const insertedIds: string[] = [];
  for (const row of batch) {
    const singleResult = await supabase
      .from("transactions")
      .insert(row)
      .select("id");

    if (singleResult.error) {
      if (isUniqueViolation(singleResult.error)) {
        continue;
      }
      throw singleResult.error;
    }

    insertedIds.push(
      ...(((singleResult.data || []) as { id: string }[]).map((item) =>
        String(item.id || ""),
      )),
    );
  }

  return insertedIds;
}

async function loadExistingTransactionCandidates(
  userId: string,
  bankAccountId: string,
  rows: { date: string; amount: number }[],
): Promise<ExistingImportedTransactionCandidate[]> {
  if (!rows.length) return [];

  const dates = rows.map((row) => row.date).filter(Boolean).sort();
  if (!dates.length) return [];

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  const { data, error } = await supabase
    .from("transactions")
    .select("id,date,amount,details,counterparty,metadata")
    .eq("user_id", userId)
    .eq("bank_account_id", bankAccountId)
    .gte("date", firstDate)
    .lte("date", lastDate);

  if (error) throw error;

  const relevantDateAmountKeys = new Set(
    rows.map((row) => buildDateAmountKey(row.date, row.amount)),
  );

  return ((data || []) as ExistingImportedTransactionCandidate[]).filter((row) => {
    const date = String(row.date || "");
    const amount =
      typeof row.amount === "number"
        ? row.amount
        : Number(row.amount || 0);
    return relevantDateAmountKeys.has(buildDateAmountKey(date, amount));
  });
}

const WRITE_BATCH_SIZE = 5;

export async function executeImportDraft(
  draft: ImportDraft,
  options: ExecuteImportDraftOptions = {},
): Promise<ImportRunResult> {
  try {
    const totalTransactions = draft.summary.totalTransactions;
    const startedAt = Date.now();

    emitProgress(options.onProgress, {
      phase: "preparing",
      message: "Koppelingen controleren…",
      detail: `${totalTransactions} transacties staan klaar om in te lezen.`,
      savedCount: 0,
      skippedCount: 0,
      totalCount: totalTransactions,
    });
    setImportRunProgress({
      phase: "preparing",
      message: "Koppelingen controleren…",
      detail: `${totalTransactions} transacties staan klaar om in te lezen.`,
      savedCount: 0,
      skippedCount: 0,
      totalCount: totalTransactions,
    });

    const userId = await requireCurrentUserId();
    const linkedGroups = draft.groups.filter((group) => Boolean(group.linkedBankAccount?.id));

    if (linkedGroups.length !== draft.groups.length) {
      throw new Error("Koppel eerst alle rekeningen voordat je de transacties inleest.");
    }

    debugImport("start import", {
      sourceLabel: draft.summary.sourceLabel,
      fileName: draft.fileName,
      totalTransactions,
      groupCount: linkedGroups.length,
    });

    let importedTransactions = 0;
    let skippedTransactions = 0;
    const insertedIds: string[] = [];

    for (const group of linkedGroups) {
      assertLinked(group);
      const bankAccountId = group.linkedBankAccount.id;
      const linkedAccount = describeLinkedAccount(group);
      const groupStartedAt = Date.now();

      const rowsToInsert: Record<string, unknown>[] = [];
      const seenKeys = new Set<string>();
      const candidateRows = group.transactions.map((row) => ({
        date: row.date,
        amount: row.amount,
      }));
      const existingRows = await loadExistingTransactionCandidates(
        userId,
        bankAccountId,
        candidateRows,
      );
      const existingRowsByDateAmount = new Map<string, ImportedTransactionMatchCandidate[]>();

      existingRows.forEach((row) => {
        const date = String((row as { date?: string | null }).date || "");
        const amount =
          typeof (row as { amount?: unknown }).amount === "number"
            ? Number((row as { amount?: number }).amount)
            : Number((row as { amount?: unknown }).amount || 0);
        const key = buildDateAmountKey(date, amount);
        const list = existingRowsByDateAmount.get(key) || [];
        list.push(row);
        existingRowsByDateAmount.set(key, list);
      });

      for (const row of group.transactions) {
        const key = buildTransactionKey(row.date, row.amount, row.details);
        if (seenKeys.has(key)) {
          skippedTransactions += 1;
          continue;
        }

        const existingCandidates =
          existingRowsByDateAmount.get(buildDateAmountKey(row.date, row.amount)) || [];
        const matchedExisting = findMatchingImportedTransaction(existingCandidates, {
          details: row.details,
          counterparty: row.counterparty,
          metadata: row.metadata,
        });
        if (matchedExisting) {
          skippedTransactions += 1;
          continue;
        }

        seenKeys.add(key);
        rowsToInsert.push({
          user_id: userId,
          bank_account_id: bankAccountId,
          date: row.date,
          details: normalizeTransactionDetails(row.details),
          counterparty: row.counterparty || null,
          amount: row.amount,
          currency: row.currency || "EUR",
          type: row.type || null,
          metadata: row.metadata,
        });
      }

      debugImport("prepared group", {
        groupKey: group.key,
        sourceAccountLabel: group.sourceAccountLabel,
        linkedAccountName: linkedAccount?.name || null,
        linkedAccountLine: linkedAccount?.line || null,
        linkedBy: group.linkedBy,
        transactionCount: group.transactionCount,
        rowsToInsert: rowsToInsert.length,
        skippedDuringPrepare: skippedTransactions,
      });

      const baseWritingProgress: ImportRunProgress = {
        phase: "writing",
        message: "Transacties worden opgeslagen…",
        detail: linkedAccount
          ? `Bron: ${group.sourceAccountLabel} · Doel: ${linkedAccount.name}`
          : `Bron: ${group.sourceAccountLabel}`,
        savedCount: importedTransactions,
        skippedCount: skippedTransactions,
        totalCount: totalTransactions,
        sourceAccountLabel: group.sourceAccountLabel,
        linkedAccountName: linkedAccount?.name || null,
        linkedAccountLine: linkedAccount?.line || null,
        linkedBy: group.linkedBy,
      };

      emitProgress(options.onProgress, baseWritingProgress);
      setImportRunProgress(baseWritingProgress);

      for (let start = 0; start < rowsToInsert.length; start += WRITE_BATCH_SIZE) {
        const batch = rowsToInsert.slice(start, start + WRITE_BATCH_SIZE);
        const batchNumber = Math.floor(start / WRITE_BATCH_SIZE) + 1;
        const batchTotal = Math.ceil(rowsToInsert.length / WRITE_BATCH_SIZE);

        debugImport("write batch start", {
          groupKey: group.key,
          sourceAccountLabel: group.sourceAccountLabel,
          linkedAccountName: linkedAccount?.name || null,
          linkedAccountLine: linkedAccount?.line || null,
          linkedBy: group.linkedBy,
          batchNumber,
          batchTotal,
          batchSize: batch.length,
          importedTransactions,
          totalTransactions,
        });

        const batchStartProgress: ImportRunProgress = {
          ...baseWritingProgress,
          batchNumber,
          batchTotal,
          batchSize: batch.length,
          savedCount: importedTransactions,
          skippedCount: skippedTransactions,
        };
        emitProgress(options.onProgress, batchStartProgress);
        setImportRunProgress(batchStartProgress);

        const groupInsertedIds = await insertTransactionBatch(batch);
        insertedIds.push(...groupInsertedIds);
        importedTransactions += groupInsertedIds.length;
        skippedTransactions += Math.max(batch.length - groupInsertedIds.length, 0);

        debugImport("write batch done", {
          groupKey: group.key,
          sourceAccountLabel: group.sourceAccountLabel,
          linkedAccountName: linkedAccount?.name || null,
          linkedAccountLine: linkedAccount?.line || null,
          linkedBy: group.linkedBy,
          batchNumber,
          batchTotal,
          inserted: groupInsertedIds.length,
          importedTransactions,
          skippedTransactions,
          elapsedMs: Date.now() - groupStartedAt,
        });

        const batchDoneProgress: ImportRunProgress = {
          ...baseWritingProgress,
          batchNumber,
          batchTotal,
          batchSize: batch.length,
          savedCount: importedTransactions,
          skippedCount: skippedTransactions,
        };
        emitProgress(options.onProgress, batchDoneProgress);
        setImportRunProgress(batchDoneProgress);
      }
    }

    const categorizationQueued = insertedIds.length > 0;

    if (categorizationQueued) {
      debugImport("finalizing import", {
        insertedIds: insertedIds.length,
        importedTransactions,
        skippedTransactions,
        elapsedMs: Date.now() - startedAt,
      });
      runCategorizationInBackground(insertedIds, userId);
    }

    const result: ImportRunResult = {
      sourceLabel: draft.summary.sourceLabel,
      fileName: draft.fileName,
      totalTransactions: draft.summary.totalTransactions,
      importedTransactions,
      skippedTransactions,
      linkedAccounts: draft.groups.length,
      periodLabel: draft.summary.periodLabel,
      categorizationQueued,
      completedAt: new Date().toISOString(),
    };

    setCurrentImportRunResult(result);
    debugImport("import complete", {
      importedTransactions,
      skippedTransactions,
      categorizationQueued,
      linkedGroups: linkedGroups.map((group) => ({
        sourceAccountLabel: group.sourceAccountLabel,
        linkedAccountName: group.linkedBankAccount?.name || null,
        linkedAccountLine: describeLinkedAccount(group)?.line || null,
        linkedBy: group.linkedBy,
      })),
      elapsedMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We konden de transacties niet inlezen.";
    setImportRunError(message);
    throw error;
  }
}
