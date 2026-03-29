import { createClient } from "@supabase/supabase-js";

import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

// Try to load a local .env file when running in environments that support it.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config();
} catch {
  // Ignore if dotenv is unavailable or if the runtime cannot load it.
}

// Prefer Expo `extra` when set, but always fall back to process.env for local runs.
const extraEnv =
  ((Constants.expoConfig?.extra as Record<string, string | undefined> | undefined) ??
    {}) as Record<string, string | undefined>;

function getEnv(key: string) {
  const extraValue = extraEnv[key];
  if (typeof extraValue === "string" && extraValue.length > 0) {
    return extraValue;
  }
  return process.env[key];
}

function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

const isDevRuntime = typeof __DEV__ === "boolean" ? __DEV__ : true;
const isNodeRuntime =
  typeof process !== "undefined" && process.release?.name === "node";
const devBypassFlag = getEnv("DEV_AUTH_BYPASS") ?? getEnv("DEV_BYPASS_LOGIN_ENABLED");
const devAuthEnabled = isTruthy(devBypassFlag) && (isDevRuntime || isNodeRuntime);

type DevAuthConfig = {
  userId: string;
  email: string;
  name: string;
  role: string;
  metadata: Record<string, unknown>;
};

function parseDevMetadata(raw?: string) {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.warn(
      "DEV_AUTH_USER_METADATA is not valid JSON. Falling back to an empty object.",
    );
    return {};
  }
}

const devAuthConfig: DevAuthConfig | null = devAuthEnabled
  ? {
      userId: getEnv("DEV_AUTH_USER_ID") ?? "dev-local-user",
      email:
        getEnv("DEV_AUTH_USER_EMAIL") ??
        getEnv("DEV_BYPASS_LOGIN_EMAIL") ??
        "dev@localhost",
      name: getEnv("DEV_AUTH_USER_NAME") ?? "Local Dev",
      role: getEnv("DEV_AUTH_USER_ROLE") ?? "authenticated",
      metadata: parseDevMetadata(getEnv("DEV_AUTH_USER_METADATA")),
    }
  : null;

function buildDevUser(userId: string, email: string, name: string, role: string): User {
  const now = new Date().toISOString();
  return {
    id: userId,
    aud: "authenticated",
    role,
    email,
    email_confirmed_at: now,
    phone: undefined,
    phone_confirmed_at: undefined,
    app_metadata: { provider: "email" },
    user_metadata: { name },
    created_at: now,
    updated_at: now,
  };
}

export function createDevSession(): Session | null {
  if (!devAuthConfig) return null;
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: "dev-access-token",
    token_type: "bearer",
    expires_in: 60 * 60,
    expires_at: now + 60 * 60,
    refresh_token: "dev-refresh-token",
    provider_token: null,
    provider_refresh_token: null,
    user: {
      ...buildDevUser(
        devAuthConfig.userId,
        devAuthConfig.email,
        devAuthConfig.name,
        devAuthConfig.role,
      ),
      user_metadata: {
        ...devAuthConfig.metadata,
        name: devAuthConfig.name,
      },
    },
  };
}

export const isDevAuthBypassEnabled = Boolean(devAuthConfig);

const url = getEnv("SUPABASE_URL");
const anonKey = getEnv("SUPABASE_ANON_KEY");

if (!url || !anonKey) {
  throw new Error(
    "Supabase environment variables are not set.\n" +
      "Make sure SUPABASE_URL and SUPABASE_ANON_KEY are defined in your .env file " +
      "and that the file is imported by metro (restart the packager after adding).",
  );
}

const SUPABASE_STORAGE_KEY = "assistant.supabase.auth.token";

const secureSessionStorage = {
  async getItem(key: string) {
    if (Platform.OS === "web") {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }

    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // Ignore storage failures in unsupported environments.
      }
      return;
    }

    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // Ignore storage failures in unsupported environments.
      }
      return;
    }

    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(url, anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
    storageKey: SUPABASE_STORAGE_KEY,
    storage: secureSessionStorage,
  },
});

let authReadQueue: Promise<void> = Promise.resolve();

function runAuthRead<T>(task: () => Promise<T>): Promise<T> {
  const next = authReadQueue.then(task, task);
  authReadQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

// Auth helpers
export async function loginWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function registerWithEmail(
  email: string,
  password: string,
  emailRedirectTo?: string,
  displayName?: string,
) {
  const options = {
    ...(emailRedirectTo ? { emailRedirectTo } : {}),
    ...(displayName?.trim()
      ? {
          data: {
            name: displayName.trim(),
            full_name: displayName.trim(),
          },
        }
      : {}),
  };

  return supabase.auth.signUp({
    email,
    password,
    options: Object.keys(options).length ? options : undefined,
  });
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string,
) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
}

export async function updatePassword(password: string) {
  return supabase.auth.updateUser({ password });
}

export async function logout() {
  try {
    return await supabase.auth.signOut();
  } finally {
    await clearSupabaseSessionStorage();
  }
}

export async function getSession(): Promise<Session | null> {
  return runAuthRead(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) return data.session;
    if (devAuthConfig) {
      return createDevSession();
    }
    return null;
  });
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}

export async function clearSupabaseSessionStorage() {
  await secureSessionStorage.removeItem(SUPABASE_STORAGE_KEY);
}
