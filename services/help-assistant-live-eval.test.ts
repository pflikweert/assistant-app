import "dotenv/config";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SHOULD_RUN = process.env.RUN_LIVE_HELP_ASSISTANT_EVAL === "1";
const ROOT = process.cwd();
const API_BASE_URL = "http://127.0.0.1:3001";
const TEST_USER_ID = process.env.HELP_ASSISTANT_EVAL_USER_ID || "08c9f32b-ed7b-45d6-94b5-bb2fefadc89c";

(globalThis as Record<string, unknown>).expo = {
  EventEmitter: class EventEmitter {},
  SharedObject: class SharedObject {},
};

vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  NativeModules: {},
  TurboModuleRegistry: {
    get: () => ({}),
    getEnforcing: () => ({}),
  },
}));

vi.mock("expo-modules-core", () => ({
  EventEmitter: class EventEmitter {},
  SharedObject: class SharedObject {},
  requireNativeModule: () => ({}),
}));

vi.mock("expo-secure-store", () => ({
  default: {},
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: {
    SHA256: "SHA256",
  },
  digestStringAsync: vi.fn(async () => "help-assistant-live-eval-hash"),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        APP_BASE_URL: API_BASE_URL,
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
        OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5.4-nano",
      },
    },
  },
}));

async function waitForServerReady(server: ChildProcessWithoutNullStreams) {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Dev API server startte niet op tijd."));
    }, 20_000);

    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (text.includes("Dev API server running")) {
        cleanup();
        resolve();
      }
    };

    const onExit = () => {
      cleanup();
      reject(new Error("Dev API server stopte onverwacht tijdens opstarten."));
    };

    const cleanup = () => {
      clearTimeout(timeout);
      server.stdout.off("data", onStdout);
      server.off("exit", onExit);
    };

    server.stdout.on("data", onStdout);
    server.on("exit", onExit);
  });
}

describe.skipIf(!SHOULD_RUN)("help assistant live eval", () => {
  let server: ChildProcessWithoutNullStreams | null = null;
  let runLiveHelpAssistantEval: typeof import("./help-assistant-live-eval").runLiveHelpAssistantEval;

  beforeAll(async () => {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw new Error("OPENAI_API_KEY ontbreekt voor live help assistant eval.");
    }
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY ontbreekt voor live help assistant eval.");
    }
    if (!process.env.SUPABASE_URL?.trim()) {
      throw new Error("SUPABASE_URL ontbreekt voor live help assistant eval.");
    }

    process.env.DEV_AUTH_BYPASS = "1";
    process.env.DEV_AUTH_USER_ID = TEST_USER_ID;
    process.env.DEV_AUTH_USER_EMAIL = "eval@localhost";
    process.env.APP_BASE_URL = API_BASE_URL;
    process.env.SUPABASE_ANON_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

    server = spawn(
      "node",
      ["--experimental-strip-types", "./scripts/dev-api-server.mjs"],
      {
        cwd: ROOT,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    server.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    server.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
    });

    await waitForServerReady(server);
    ({ runLiveHelpAssistantEval } = await import("./help-assistant-live-eval"));
  }, 40_000);

  afterAll(() => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  });

  it(
    "valideert assistant-antwoorden tegen echte databasefeiten",
    async () => {
      const report = await runLiveHelpAssistantEval({
        limit: Number(process.env.HELP_ASSISTANT_EVAL_LIMIT || 100),
      });

      await mkdir(path.join(ROOT, "tmp"), { recursive: true });
      await writeFile(
        path.join(ROOT, "tmp", "help-assistant-live-eval-report.json"),
        JSON.stringify(report, null, 2),
        "utf8",
      );

      expect(report.summary.strictFailed).toBe(0);
    },
    15 * 60 * 1000,
  );
});
