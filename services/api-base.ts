import Constants from "expo-constants";

export function getApiBaseUrl() {
  const extra =
    Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
  const configuredBaseUrl =
    extra?.APP_BASE_URL || process.env.APP_BASE_URL || process.env.SITE_URL;

  if (configuredBaseUrl?.trim()) {
    try {
      const parsed = new URL(configuredBaseUrl.trim());
      if (
        (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
        (parsed.port === "8081" || parsed.port === "8080")
      ) {
        return "http://localhost:3001";
      }
    } catch {
      // Fall through and return the configured value as-is below.
    }
    return configuredBaseUrl.trim();
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return "http://localhost:3001";
    }
    return window.location.origin;
  }

  return null;
}
