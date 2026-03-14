export function isAuthRoute(segments: readonly string[]): boolean {
  const firstSegment = String(segments[0] || "").trim().toLowerCase();
  return firstSegment === "auth" || firstSegment === "login";
}

export function getAuthRedirectPath(input: {
  loading: boolean;
  isAuthenticated: boolean;
  segments: readonly string[];
  recoveryFlow?: boolean;
}): string | null {
  if (input.loading) return null;

  const onAuthRoute = isAuthRoute(input.segments);
  if (!input.isAuthenticated && !onAuthRoute) {
    return "/auth/login";
  }
  if (input.isAuthenticated && onAuthRoute && !input.recoveryFlow) {
    return "/";
  }
  return null;
}
