import { MATERIAL_ICON_FONT_MAP } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { clearCategorizationClientState } from "@/services/categorization";
import { getAuthRedirectPath } from "@/services/auth-routing";
import {
  clearCurrentImportDraft,
  clearCurrentImportRunResult,
} from "@/services/import/import-flow-state";
import {
  createDevSession,
  clearSupabaseSessionStorage,
  getSession,
  isDevAuthBypassEnabled,
  loginWithEmail,
  logout,
  onAuthStateChange,
  registerWithEmail,
  requestPasswordReset,
  updatePassword as updatePasswordForCurrentUser,
} from "@/services/supabase";
import {
  isRefreshTokenAuthError,
  isSessionIdleExpired,
} from "@/services/auth-session";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import type { Session, User } from "@supabase/supabase-js";
import { useFonts } from "expo-font";
import {
  type Href,
  Stack,
  useRootNavigationState,
  useRouter,
  usePathname,
  useSegments,
  useLocalSearchParams,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, LogBox, type AppStateStatus } from "react-native";
import "react-native-reanimated";

function patchReactDevToolsVersion() {
  if (process.env.NODE_ENV === "production") return;
  if (typeof window === "undefined") return;

  const hook = (window as typeof window & {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: {
      inject?: (renderer: { version?: string }) => unknown;
      __budioVersionPatched?: boolean;
    };
  }).__REACT_DEVTOOLS_GLOBAL_HOOK__;

  if (!hook || hook.__budioVersionPatched || typeof hook.inject !== "function") {
    return;
  }

  const originalInject = hook.inject.bind(hook);
  hook.inject = (renderer) => {
    if (renderer && typeof renderer.version === "string" && !renderer.version.trim()) {
      renderer.version = React.version || "19.1.0";
    }
    return originalInject(renderer);
  };
  hook.__budioVersionPatched = true;
}

patchReactDevToolsVersion();
// Session context
type SessionContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  login: typeof loginWithEmail;
  register: typeof registerWithEmail;
  requestPasswordReset: typeof requestPasswordReset;
  updatePassword: typeof updatePasswordForCurrentUser;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(
    AppState.currentState,
  );
  const sessionRef = useRef<Session | null>(null);
  const lastActiveAtRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearIdleMarker = useCallback(() => {
    lastActiveAtRef.current = null;
  }, []);

  const handleForcedLogout = useCallback(
    async (reason: "idle_timeout" | "refresh_token_error" | "signed_out") => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      try {
        clearCategorizationClientState();
        clearCurrentImportDraft();
        clearCurrentImportRunResult();
        setSession(null);
        clearIdleMarker();

        if (reason === "idle_timeout") {
          console.warn("[auth] session expired after inactivity");
        }

        if (!isDevAuthBypassEnabled) {
          try {
            await logout();
          } catch (error) {
            if (!isRefreshTokenAuthError(error)) {
              console.warn("[auth] logout failed", error);
            }
          } finally {
            await clearSupabaseSessionStorage();
          }
        }
      } finally {
        loggingOutRef.current = false;
        setLoading(false);
      }
    },
    [clearIdleMarker],
  );

  const loadSession = useCallback(async () => {
    if (isDevAuthBypassEnabled) {
      setSession(createDevSession());
      setLoading(false);
      return;
    }

    try {
      const sess = await getSession();
      setSession(sess);
      if (sess) {
        lastActiveAtRef.current = Date.now();
      } else {
        clearIdleMarker();
      }
    } catch (error) {
      if (isRefreshTokenAuthError(error)) {
        await handleForcedLogout("refresh_token_error");
        return;
      }

      console.warn("[auth] session bootstrap failed", error);
      setSession(null);
      clearIdleMarker();
    } finally {
      setLoading(false);
    }
  }, [clearIdleMarker, handleForcedLogout]);

  useEffect(() => {
    void loadSession();

    if (isDevAuthBypassEnabled) {
      return;
    }

    const { data: listener } = onAuthStateChange((event, sess) => {
      if (event === "SIGNED_OUT") {
        clearCategorizationClientState();
        clearCurrentImportDraft();
        clearCurrentImportRunResult();
        void clearSupabaseSessionStorage();
        setSession(null);
        clearIdleMarker();
        setLoading(false);
        return;
      }

      setSession(sess);
      if (sess) {
        lastActiveAtRef.current = Date.now();
      } else {
        clearIdleMarker();
      }
      setLoading(false);
    });

    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, [clearIdleMarker, loadSession]);

  useEffect(() => {
    if (isDevAuthBypassEnabled) return;

    const subscription = AppState.addEventListener("change", (nextState) => {
      setAppState(nextState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isDevAuthBypassEnabled || loading) return;
    if (appState !== "active") return;

    const currentSession = sessionRef.current;
    if (!currentSession) return;

    const lastActiveAt = lastActiveAtRef.current;
    if (lastActiveAt && isSessionIdleExpired(lastActiveAt)) {
      void handleForcedLogout("idle_timeout");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const freshSession = await getSession();
        if (cancelled) return;

        setSession(freshSession);
        if (freshSession) {
          lastActiveAtRef.current = Date.now();
        } else {
          clearCategorizationClientState();
          clearCurrentImportDraft();
          clearCurrentImportRunResult();
          clearIdleMarker();
          await clearSupabaseSessionStorage();
        }
      } catch (error) {
        if (cancelled) return;

        if (isRefreshTokenAuthError(error)) {
          await handleForcedLogout("refresh_token_error");
          return;
        }

        console.warn("[auth] session refresh failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appState, clearIdleMarker, handleForcedLogout, loading]);

  const user = session?.user ?? null;
  const handleLogout = useCallback(async () => {
    await handleForcedLogout("signed_out");
  }, [handleForcedLogout]);

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      login: loginWithEmail,
      register: registerWithEmail,
      requestPasswordReset,
      updatePassword: updatePasswordForCurrentUser,
      logout: handleLogout,
    }),
    [handleLogout, loading, session, user],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

LogBox.ignoreLogs([
  "props.pointerEvents is deprecated. Use style.pointerEvents",
]);

// Override DarkTheme with our fintech palette
const FinTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: FinColors.bgBase,
    card: FinColors.bgCard,
    text: FinColors.textPrimary,
    border: FinColors.borderSubtle,
    primary: FinColors.green,
  },
};

export const unstable_settings = {
  anchor: "(tabs)",
};

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useSession();
  const rootNavigationState = useRootNavigationState();
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const searchParams = useLocalSearchParams();
  const recoveryFlow =
    searchParams.type === "recovery" && Boolean(searchParams.token);

  const redirectPath = getAuthRedirectPath({
    loading,
    isAuthenticated: Boolean(user),
    segments,
    pathname,
    recoveryFlow,
  });

  useEffect(() => {
    if (!rootNavigationState?.key || !redirectPath) return;
    router.replace(redirectPath as Href);
  }, [redirectPath, rootNavigationState?.key, router]);

  if (loading || !rootNavigationState?.key) {
    return null;
  }

  return <>{children}</>;
}

function RootNavigator() {
  return (
    <AuthGate>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: FinColors.bgCard },
          headerTintColor: FinColors.textPrimary,
          headerTitleStyle: {
            fontWeight: "700",
            color: FinColors.textPrimary,
          },
          contentStyle: { backgroundColor: FinColors.bgBase },
        }}
      >
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="csv-import"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="rekeningen-koppelen"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="import-control"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="import-afronden"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="bankrekeningen"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="modal"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="transaction-detail"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="transactions"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="analysis-detail"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="subscriptions"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="category-budget-groups"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/index"
          options={{
            headerShown: false,
          }}
        />
      </Stack>
    </AuthGate>
  );
}


function RecoveryRedirector({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    // Detect recovery-token in de URL (type=recovery & token aanwezig)
    if (params?.type === 'recovery' && params?.token) {
      const query = Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&');
      const target =
        `/auth/reset-password${query ? `?${query}` : ""}` as Href;
      router.replace(target);
    }
  }, [params, router]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [iconFontsLoaded, iconFontsError] = useFonts(MATERIAL_ICON_FONT_MAP);

  if (iconFontsError) {
    throw iconFontsError;
  }

  if (!iconFontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={FinTheme}>
      <SessionProvider>
        <RecoveryRedirector>
          <RootNavigator />
          <StatusBar style="light" />
        </RecoveryRedirector>
      </SessionProvider>
    </ThemeProvider>
  );
}
