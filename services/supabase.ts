import { createClient } from "@supabase/supabase-js";

// try to load a local .env file if present (expo may already do this)
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("dotenv").config();
} catch {
  // ignore if dotenv isn't installed or fails
}

import Constants from "expo-constants";

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

export const supabase = createClient(url, anonKey);
