import Constants from "expo-constants";

export function getApiBaseUrl() {
  const extra =
    Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const configuredBaseUrl =
    extra?.APP_BASE_URL || process.env.APP_BASE_URL || process.env.SITE_URL;

  if (configuredBaseUrl?.trim()) return configuredBaseUrl.trim();

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "https://ezas.nl";
    }
    return window.location.origin;
  }

  return null;
}
