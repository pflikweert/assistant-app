import { FinColors } from "@/constants/theme";
import { clearCategorizationClientState } from "@/services/categorization";
import { getAuthRedirectPath } from "@/services/auth-routing";
import {
  createDevSession,
  getSession,
  isDevAuthBypassEnabled,
  loginWithEmail,
  logout,
  onAuthStateChange,
  registerWithEmail,
  requestPasswordReset,
  updatePassword as updatePasswordForCurrentUser,
} from "@/services/supabase";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import type { Session, User } from "@supabase/supabase-js";
import {
  type Href,
  Stack,
  useRootNavigationState,
  useRouter,
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
  useState,
} from "react";
import { LogBox } from "react-native";
import "react-native-reanimated";
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

  useEffect(() => {
    if (isDevAuthBypassEnabled) {
      setSession(createDevSession());
      setLoading(false);
      return;
    }

    getSession()
      .then((sess) => {
        setSession(sess);
      })
      .finally(() => {
        setLoading(false);
      });
    const { data: listener } = onAuthStateChange((_event, sess) => {
      setSession(sess);
      setLoading(false);
    });
    return () => {
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const user = session?.user ?? null;
  const handleLogout = useCallback(async () => {
    clearCategorizationClientState();
    await logout();
  }, []);

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
  const segments = useSegments();
  const searchParams = useLocalSearchParams();
  const recoveryFlow =
    searchParams.type === "recovery" && Boolean(searchParams.token);

  const redirectPath = getAuthRedirectPath({
    loading,
    isAuthenticated: Boolean(user),
    segments,
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
          options={{ title: "Import Transactions", headerShown: true }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Info" }}
        />
        <Stack.Screen
          name="transaction-detail"
          options={{
            presentation: "modal",
            title: "Transactie",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="analysis-detail"
          options={{ title: "Analyse detail", headerShown: true }}
        />
        <Stack.Screen
          name="subscriptions"
          options={{ title: "Abonnementen", headerShown: true }}
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
        `/auth/new-password${query ? `?${query}` : ""}` as Href;
      router.replace(target);
    }
  }, [params, router]);

  return <>{children}</>;
}

export default function RootLayout() {
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
