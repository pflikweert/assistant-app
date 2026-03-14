import { createClient } from "@supabase/supabase-js";

// try to load a local .env file if present (expo may already do this)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
} catch {
  // ignore if dotenv isn't installed or fails
}

import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Expo provides runtime variables under Constants.expoConfig.extra when using
// an app.config.js or app.json with an "extra" field.  Fallback to process.env
// for environments where Constants may not be available (e.g. server-side).
const env: Record<string, string | undefined> =
  (Constants.expoConfig?.extra as any) || process.env;

const url = env.SUPABASE_URL;
const anonKey = env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase environment variables are not set.\n" +
      "Make sure SUPABASE_URL and SUPABASE_ANON_KEY are defined in your .env file " +
      "and that the file is imported by metro (restart the packager after adding).",
  );
}

import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

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

// Auth helpers
export async function loginWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function registerWithEmail(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
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
  return supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange(callback);
}
