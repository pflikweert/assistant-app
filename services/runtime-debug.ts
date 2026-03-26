function isTruthy(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

export function isRuntimeDebugEnabled() {
  return isTruthy(process.env.EXPO_PUBLIC_IMPORT_DEBUG);
}

export function debugLog(message: string, data?: Record<string, unknown>) {
  if (!isRuntimeDebugEnabled()) return;
  if (data) {
    console.log(`[budio-debug] ${message}`, data);
    return;
  }
  console.log(`[budio-debug] ${message}`);
}

