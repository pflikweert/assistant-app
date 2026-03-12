import React from "react";

export type CategorizationRunMode = "import" | "pending" | "recategorize-all";

export type CategorizationStatus = {
  phase: "idle" | "queued" | "running" | "paused" | "completed" | "error";
  mode: CategorizationRunMode | null;
  queuedCount: number;
  totalCount: number;
  processedCount: number;
  updatedCount: number;
  ruleCount: number;
  openAiCount: number;
  skippedCount: number;
  message: string;
  lastCompletedAt: string | null;
  lastError: string | null;
  lastRunMode: CategorizationRunMode | null;
  isStopRequested: boolean;
  isPauseRequested: boolean;
};

const listeners = new Set<() => void>();

let status: CategorizationStatus = {
  phase: "idle",
  mode: null,
  queuedCount: 0,
  totalCount: 0,
  processedCount: 0,
  updatedCount: 0,
  ruleCount: 0,
  openAiCount: 0,
  skippedCount: 0,
  message: "Geen achtergrondtaken actief.",
  lastCompletedAt: null,
  lastError: null,
  lastRunMode: null,
  isStopRequested: false,
  isPauseRequested: false,
};

function emit() {
  for (const listener of listeners) listener();
}

export function getCategorizationStatusSnapshot() {
  return status;
}

export function subscribeCategorizationStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCategorizationStatus() {
  return React.useSyncExternalStore(
    subscribeCategorizationStatus,
    getCategorizationStatusSnapshot,
    getCategorizationStatusSnapshot,
  );
}

export function updateCategorizationStatus(
  updater:
    | Partial<CategorizationStatus>
    | ((current: CategorizationStatus) => CategorizationStatus),
) {
  status =
    typeof updater === "function"
      ? updater(status)
      : { ...status, ...updater };
  emit();
}

export function formatCategorizationStatus(statusValue: CategorizationStatus) {
  if (statusValue.phase === "running") {
    const base = `${statusValue.processedCount}/${statusValue.totalCount} verwerkt, ${statusValue.queuedCount} in wachtrij`;
    if (
      statusValue.message &&
      statusValue.message !== "Categorisatie draait op de achtergrond."
    ) {
      return `${base} • ${statusValue.message}`;
    }
    return base;
  }
  if (statusValue.phase === "paused") {
    return `Gepauzeerd na ${statusValue.processedCount}/${statusValue.totalCount}, ${statusValue.queuedCount} resterend`;
  }
  if (statusValue.phase === "queued") {
    return `${statusValue.queuedCount} transacties staan klaar voor categorisatie`;
  }
  if (statusValue.phase === "completed") {
    return `${statusValue.updatedCount} bijgewerkt, ${statusValue.skippedCount} overgeslagen`;
  }
  if (statusValue.phase === "error") {
    return statusValue.lastError || "Achtergrondtaak mislukt";
  }
  return statusValue.message;
}