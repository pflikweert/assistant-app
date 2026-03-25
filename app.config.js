import "dotenv/config";

const appJson = require("./app.json");

export default {
  expo: {
    ...appJson.expo,
    plugins: ["expo-secure-store"],
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      APP_BASE_URL:
        process.env.APP_BASE_URL ||
        process.env.EXPO_PUBLIC_SITE_URL ||
        process.env.SITE_URL,
      SITE_URL:
        process.env.EXPO_PUBLIC_SITE_URL ||
        process.env.SITE_URL ||
        process.env.APP_PUBLIC_URL,
      DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS,
      DEV_AUTH_USER_ID: process.env.DEV_AUTH_USER_ID,
      DEV_AUTH_USER_EMAIL: process.env.DEV_AUTH_USER_EMAIL,
      DEV_AUTH_USER_NAME: process.env.DEV_AUTH_USER_NAME,
      DEV_AUTH_USER_ROLE: process.env.DEV_AUTH_USER_ROLE,
      DEV_AUTH_USER_METADATA: process.env.DEV_AUTH_USER_METADATA,
      DEV_BYPASS_LOGIN_ENABLED: process.env.DEV_BYPASS_LOGIN_ENABLED,
      DEV_BYPASS_LOGIN_EMAIL: process.env.DEV_BYPASS_LOGIN_EMAIL,
      DEV_BYPASS_LOGIN_PASSWORD: process.env.DEV_BYPASS_LOGIN_PASSWORD,
    },
  },
};
