import Constants from "expo-constants";
import * as Linking from "expo-linking";

function getConfiguredSiteUrl() {
  const extra =
    Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;

  const configured =
    extra?.SITE_URL ||
    extra?.EXPO_PUBLIC_SITE_URL ||
    process.env.EXPO_PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  if (!configured?.trim()) return null;

  try {
    return new URL(configured.trim()).origin;
  } catch {
    return null;
  }
}

export function getAuthRedirectUrl(path: string) {
  const configuredSiteUrl = getConfiguredSiteUrl();
  if (configuredSiteUrl) {
    return new URL(path, configuredSiteUrl).toString();
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }

  return Linking.createURL(path);
}
