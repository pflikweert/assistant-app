import * as Linking from "expo-linking";

export function getAuthRedirectUrl(path: string) {
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }

  return Linking.createURL(path);
}
