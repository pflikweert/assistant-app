import { Platform } from "react-native";

export const INSIGHTS_HIGHLIGHT_REPEAT_WINDOW_MS = 72 * 60 * 60 * 1000;

const STORAGE_PREFIX = "assistant.insights.highlight-history.v1";

export type InsightsHighlightSignalSource = "hard" | "ai-influenced";

export type InsightsHighlightHistoryEntry = {
  fingerprint: string;
  lastSeenAt: string;
  signalSource: InsightsHighlightSignalSource;
};

export type InsightsHighlightHistoryState = {
  version: 1;
  userId: string;
  monthKey: string;
  updatedAt: string;
  entries: Record<string, InsightsHighlightHistoryEntry>;
};

export type InsightsHighlightHistoryInput = {
  meaningKey: string;
  fingerprint: string;
  signalSource: InsightsHighlightSignalSource;
};

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

let secureStoreModulePromise:
  | Promise<typeof import("expo-secure-store")>
  | null = null;

async function getSecureStoreModule() {
  if (!secureStoreModulePromise) {
    secureStoreModulePromise = import("expo-secure-store");
  }
  return secureStoreModulePromise;
}

function getStorageKey(userId: string, monthKey: string) {
  return `${STORAGE_PREFIX}:${userId}:${monthKey}`;
}

function getStorage(): StorageAdapter | null {
  if (Platform.OS === "web") {
    return {
      async getItem(key: string) {
        try {
          return globalThis.localStorage?.getItem(key) ?? null;
        } catch {
          return null;
        }
      },
      async setItem(key: string, value: string) {
        try {
          globalThis.localStorage?.setItem(key, value);
        } catch {
          // Ignore storage failures in unsupported browser contexts.
        }
      },
    };
  }

  return {
    async getItem(key: string) {
      try {
        const SecureStore = await getSecureStoreModule();
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string) {
      try {
        const SecureStore = await getSecureStoreModule();
        await SecureStore.setItemAsync(key, value);
      } catch {
        // Ignore storage failures in unsupported native contexts.
      }
    },
  };
}

function createEmptyState(userId: string, monthKey: string): InsightsHighlightHistoryState {
  return {
    version: 1,
    userId,
    monthKey,
    updatedAt: new Date(0).toISOString(),
    entries: {},
  };
}

function parseHistoryState(
  raw: string | null,
  userId: string,
  monthKey: string,
): InsightsHighlightHistoryState {
  if (!raw) return createEmptyState(userId, monthKey);

  try {
    const parsed = JSON.parse(raw) as Partial<InsightsHighlightHistoryState>;
    if (
      parsed?.version !== 1 ||
      parsed.userId !== userId ||
      parsed.monthKey !== monthKey ||
      typeof parsed.updatedAt !== "string" ||
      typeof parsed.entries !== "object" ||
      parsed.entries === null
    ) {
      return createEmptyState(userId, monthKey);
    }

    const entries: Record<string, InsightsHighlightHistoryEntry> = {};
    for (const [meaningKey, entry] of Object.entries(parsed.entries)) {
      if (
        !meaningKey ||
        typeof entry?.fingerprint !== "string" ||
        typeof entry?.lastSeenAt !== "string" ||
        (entry.signalSource !== "hard" && entry.signalSource !== "ai-influenced")
      ) {
        continue;
      }

      entries[meaningKey] = {
        fingerprint: entry.fingerprint,
        lastSeenAt: entry.lastSeenAt,
        signalSource: entry.signalSource,
      };
    }

    return {
      version: 1,
      userId,
      monthKey,
      updatedAt: parsed.updatedAt,
      entries,
    };
  } catch {
    return createEmptyState(userId, monthKey);
  }
}

async function readHistoryState(
  userId: string,
  monthKey: string,
): Promise<InsightsHighlightHistoryState> {
  const storage = getStorage();
  if (!storage) return createEmptyState(userId, monthKey);

  const raw = await storage.getItem(getStorageKey(userId, monthKey));
  return parseHistoryState(raw, userId, monthKey);
}

async function writeHistoryState(state: InsightsHighlightHistoryState) {
  const storage = getStorage();
  if (!storage) return;

  await storage.setItem(getStorageKey(state.userId, state.monthKey), JSON.stringify(state));
}

export async function loadInsightsHighlightHistory(
  userId: string,
  monthKey: string,
): Promise<InsightsHighlightHistoryState> {
  return readHistoryState(userId, monthKey);
}

export function shouldSuppressRepeatedInsight(
  history: InsightsHighlightHistoryState | null,
  item: InsightsHighlightHistoryInput,
  now = Date.now(),
  windowMs = INSIGHTS_HIGHLIGHT_REPEAT_WINDOW_MS,
) {
  if (!history) return false;

  const entry = history.entries[item.meaningKey];
  if (!entry || entry.fingerprint !== item.fingerprint) return false;

  const seenAt = Date.parse(entry.lastSeenAt);
  if (!Number.isFinite(seenAt)) return false;

  return now - seenAt < windowMs;
}

export async function recordInsightsHighlightHistory(
  userId: string,
  monthKey: string,
  items: InsightsHighlightHistoryInput[],
): Promise<InsightsHighlightHistoryState> {
  const nowIso = new Date().toISOString();
  const nextState = await readHistoryState(userId, monthKey);

  for (const item of items) {
    if (!item.meaningKey || !item.fingerprint) continue;

    nextState.entries[item.meaningKey] = {
      fingerprint: item.fingerprint,
      lastSeenAt: nowIso,
      signalSource: item.signalSource,
    };
  }

  nextState.updatedAt = nowIso;
  await writeHistoryState(nextState);
  return nextState;
}
