import React from "react";
import { Platform } from "react-native";

const DEFAULT_CHECK_INTERVAL_MS = 60_000;
const DEFAULT_GRACE_PERIOD_MS = 5_000;
const DEFAULT_RELOAD_DELAY_MS = 1_500;
const RELOAD_GUARD_KEY = "budio_web_reload_build_id";

export type WebDeployRefreshState = {
  updateReady: boolean;
  message: string | null;
  currentBuildId: string | null;
  remoteBuildId: string | null;
};

export function parseBuildIdFromHtml(html: string): string | null {
  if (!html || typeof html !== "string") return null;

  const metaMatch = html.match(
    /<meta[^>]*name=["']budio-build-id["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  );
  if (metaMatch?.[1]) {
    const value = String(metaMatch[1]).trim();
    if (value) return value;
  }

  const scriptMatch = html.match(
    /__BUDIO_BUILD_ID__\s*=\s*["']([^"']+)["']/i,
  );
  if (scriptMatch?.[1]) {
    const value = String(scriptMatch[1]).trim();
    if (value) return value;
  }

  return null;
}

export function isReloadNeeded(params: {
  currentBuildId: string | null;
  remoteBuildId: string | null;
  alreadyReloadedBuildId: string | null;
}) {
  const current = String(params.currentBuildId || "").trim();
  const remote = String(params.remoteBuildId || "").trim();
  const done = String(params.alreadyReloadedBuildId || "").trim();

  if (!current || !remote) return false;
  if (current === remote) return false;
  if (done && done === remote) return false;
  return true;
}

function readCurrentBuildId() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  const winValue = String((window as any).__BUDIO_BUILD_ID__ || "").trim();
  if (winValue) return winValue;
  const meta = document.querySelector('meta[name="budio-build-id"]');
  const metaValue = String(meta?.getAttribute("content") || "").trim();
  return metaValue || null;
}

async function fetchRemoteBuildId() {
  if (typeof fetch === "undefined") return null;

  const response = await fetch(`/?t=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache, no-store, must-revalidate",
      pragma: "no-cache",
      expires: "0",
    },
  });

  if (!response.ok) return null;
  const html = await response.text();
  return parseBuildIdFromHtml(html);
}

function readReloadGuardBuildId() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return String(sessionStorage.getItem(RELOAD_GUARD_KEY) || "").trim() || null;
  } catch {
    return null;
  }
}

function writeReloadGuardBuildId(buildId: string | null) {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (!buildId) {
      sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return;
    }
    sessionStorage.setItem(RELOAD_GUARD_KEY, buildId);
  } catch {
    // best effort
  }
}

export function useWebDeployAutoRefresh(options?: {
  checkIntervalMs?: number;
  gracePeriodMs?: number;
  reloadDelayMs?: number;
}) {
  const [state, setState] = React.useState<WebDeployRefreshState>({
    updateReady: false,
    message: null,
    currentBuildId: null,
    remoteBuildId: null,
  });

  React.useEffect(() => {
    if (Platform.OS !== "web") return;
    if (typeof window === "undefined" || typeof document === "undefined") return;

    let cancelled = false;
    let reloadQueued = false;
    let intervalHandle: ReturnType<typeof setInterval> | null = null;
    let delayHandle: ReturnType<typeof setTimeout> | null = null;
    let graceHandle: ReturnType<typeof setTimeout> | null = null;

    const checkIntervalMs = options?.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS;
    const gracePeriodMs = options?.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS;
    const reloadDelayMs = options?.reloadDelayMs ?? DEFAULT_RELOAD_DELAY_MS;

    const runCheck = async () => {
      if (cancelled || reloadQueued) return;
      try {
        const currentBuildId = readCurrentBuildId();
        const remoteBuildId = await fetchRemoteBuildId();
        const alreadyReloadedBuildId = readReloadGuardBuildId();
        const shouldReload = isReloadNeeded({
          currentBuildId,
          remoteBuildId,
          alreadyReloadedBuildId,
        });

        if (!shouldReload) return;
        reloadQueued = true;
        writeReloadGuardBuildId(remoteBuildId);
        setState({
          updateReady: true,
          message:
            "Er is een nieuwe versie van Budio beschikbaar. We verversen je scherm…",
          currentBuildId,
          remoteBuildId,
        });

        delayHandle = setTimeout(() => {
          if (cancelled) return;
          window.location.reload();
        }, reloadDelayMs);
      } catch {
        // fail silent on network/parser issues
      }
    };

    graceHandle = setTimeout(() => {
      void runCheck();
      intervalHandle = setInterval(() => {
        void runCheck();
      }, checkIntervalMs);
    }, gracePeriodMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void runCheck();
      }
    };
    const onFocus = () => {
      void runCheck();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (intervalHandle) clearInterval(intervalHandle);
      if (delayHandle) clearTimeout(delayHandle);
      if (graceHandle) clearTimeout(graceHandle);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [options?.checkIntervalMs, options?.gracePeriodMs, options?.reloadDelayMs]);

  return state;
}

