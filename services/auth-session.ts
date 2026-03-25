export const STALE_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000;

function collectErrorText(error: unknown) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object") return "";

  const record = error as Record<string, unknown>;
  const parts = [
    record.message,
    record.error_description,
    record.name,
    record.code,
    record.status,
    record.cause,
  ].filter((value): value is string | number => {
    return typeof value === "string" || typeof value === "number";
  });

  return parts.map(String).join(" ").trim();
}

export function isRefreshTokenAuthError(error: unknown) {
  const text = collectErrorText(error).toLowerCase();
  return (
    text.includes("invalid refresh token") ||
    text.includes("refresh token not found")
  );
}

export function isSessionIdleExpired(
  lastActiveAtMs: number,
  nowMs = Date.now(),
  timeoutMs = STALE_SESSION_TIMEOUT_MS,
) {
  return nowMs - lastActiveAtMs >= timeoutMs;
}

