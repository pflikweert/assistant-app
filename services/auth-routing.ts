export function isAuthRoute(segments: readonly string[]): boolean {
  const firstSegment = String(segments[0] || "").trim().toLowerCase();
  return firstSegment === "auth" || firstSegment === "login";
}

function normalizePathname(pathname?: string | null) {
  if (!pathname) return null;
  const normalized = pathname.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function isRecoveryRoute(input: {
  segments: readonly string[];
  pathname?: string | null;
}): boolean {
  const pathname = normalizePathname(input.pathname);
  if (pathname) {
    return pathname === "/auth/reset-password";
  }

  const firstSegment = String(input.segments[0] || "").trim().toLowerCase();
  const secondSegment = String(input.segments[1] || "").trim().toLowerCase();
  return firstSegment === "auth" && secondSegment === "reset-password";
}

export function getAuthRedirectPath(input: {
  loading: boolean;
  isAuthenticated: boolean;
  segments: readonly string[];
  pathname?: string | null;
  recoveryFlow?: boolean;
}): string | null {
  if (input.loading) return null;

  const onAuthRoute = isAuthRoute(input.segments);
  const onRecoveryRoute = isRecoveryRoute({
    segments: input.segments,
    pathname: input.pathname,
  });
  if (!input.isAuthenticated && !onAuthRoute) {
    return "/auth/login";
  }
  if (
    input.isAuthenticated &&
    onAuthRoute &&
    !input.recoveryFlow &&
    !onRecoveryRoute
  ) {
    return "/";
  }
  return null;
}
