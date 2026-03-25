import React, { useEffect, useState } from "react";
import type { Href } from "expo-router";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import AuthErrorMessage from "@/components/auth/AuthErrorMessage";
import { getApiBaseUrl } from "@/services/api-base";
import { getPasswordUpdateErrorMessage } from "@/services/auth-password-errors";
import {
  getPasswordFeedback,
  getPasswordRequirementsText,
} from "@/services/auth-password-validation";
import { supabase } from "@/services/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const errorParam =
    typeof params.error === "string" ? params.error : undefined;
  const errorCode =
    typeof params.error_code === "string" ? params.error_code : undefined;
  const errorDescription =
    typeof params.error_description === "string"
      ? params.error_description
      : undefined;
  const {
    passwordValid,
    confirmValid,
    passwordsMatch,
    passwordHint,
    confirmHint,
  } = getPasswordFeedback(password, confirm);

  const disabled =
    loading ||
    sessionLoading ||
    !session ||
    !passwordValid ||
    !confirmValid;

  useEffect(() => {
    let mounted = true;
    let resolved = false;

    const resolveSession = (
      nextSession: Session | null,
      nextError: string | null,
    ) => {
      if (!mounted || resolved) return;
      resolved = true;
      setSession(nextSession);
      setSessionError(nextError);
      setSessionLoading(false);
    };

    const timeout = setTimeout(async () => {
      if (!mounted || resolved) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted || resolved) return;
        if (data.session) {
          resolveSession(data.session, null);
          return;
        }
      } catch {
        // Fall through to the invalid-token state below.
      }

      resolveSession(null, "invalid_token");
    }, 1500);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        if (!mounted || resolved) return;
        if (
          (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") &&
          currentSession
        ) {
          resolveSession(currentSession, null);
        }
      },
    );

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted || resolved) return;
        if (data.session) {
          resolveSession(data.session, null);
        }
      } catch {
        // We keep waiting for the auth-state event or the timeout fallback.
      }
    })();

    return () => {
      mounted = false;
      clearTimeout(timeout);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (disabled) return;
    setError(null);
    if (!session) {
      setError("De resetlink is verlopen of ongeldig. Vraag een nieuwe link aan.");
      return;
    }
    if (!passwordsMatch) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }
    setLoading(true);
    try {
      const timestamp = new Date().toISOString();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { password_reset_at: timestamp },
      });
      if (updateError) throw updateError;

      const baseUrl = getApiBaseUrl();
      if (!baseUrl) {
        throw new Error("Kan de API-locatie niet bepalen voor reset logging.");
      }

      const response = await fetch(
        new URL("/api/auth/reset-password-log", baseUrl).toString(),
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          method: "recovery_email",
          metadata: {
            platform: Platform.OS,
          },
        }),
      },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Loggen mislukt");
      }

      Alert.alert(
        "Succes",
        "Je wachtwoord is vernieuwd. Je kunt nu opnieuw inloggen.",
      );
      router.replace("/auth/login" as Href);
    } catch (err) {
      setError(
        getPasswordUpdateErrorMessage(
          err,
          "Wachtwoord resetten mislukt.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <AuthScreenShell
        title="Resetlink controleren"
        subtitle="Even geduld, we controleren of je link nog geldig is."
      >
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#111111" />
          <Text style={styles.loadingText}>
            Bezig met het valideren van je resetlink…
          </Text>
        </View>
      </AuthScreenShell>
    );
  }

  const recoveryError =
    errorParam ||
    errorCode ||
    (!session && !sessionLoading && sessionError ? sessionError : undefined);

  if (recoveryError) {
    return (
      <AuthErrorMessage
        code={
          typeof recoveryError === "string" ? recoveryError : undefined
        }
        description={errorDescription}
        onReset={() => router.replace("/auth/forgot-password" as Href)}
      />
    );
  }

  return (
    <AuthScreenShell
      title="Nieuw wachtwoord"
      subtitle="Stel een nieuw wachtwoord in voor je account."
      links={[
        {
          href: "/auth/login" as Href,
          prompt: "Terug naar",
          label: "Inloggen",
        },
      ]}
    >
      <Text style={authScreenStyles.fieldLabel}>Nieuw wachtwoord</Text>
      <TextInput
        style={authScreenStyles.input}
        placeholder="Kies een nieuw wachtwoord"
        placeholderTextColor="#8F8A83"
        secureTextEntry
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          if (error) setError(null);
        }}
        editable={!loading}
      />
      {passwordHint ? (
        <Text style={authScreenStyles.inlineHint}>{passwordHint}</Text>
      ) : null}
      <Text style={authScreenStyles.fieldLabel}>Bevestig wachtwoord</Text>
      <TextInput
        style={authScreenStyles.input}
        placeholder="Herhaal het wachtwoord"
        placeholderTextColor="#8F8A83"
        secureTextEntry
        value={confirm}
        onChangeText={(value) => {
          setConfirm(value);
          if (error) setError(null);
        }}
        editable={!loading}
      />
      {confirmHint ? (
        <Text style={authScreenStyles.inlineHint}>{confirmHint}</Text>
      ) : null}
      <Text style={authScreenStyles.helperText}>
        {getPasswordRequirementsText()} Je huidige wachtwoord is hier niet nodig.
      </Text>
      {error ? <Text style={authScreenStyles.errorText}>{error}</Text> : null}
      <Pressable
        style={[
          authScreenStyles.button,
          disabled && authScreenStyles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={disabled}
      >
        {loading ? (
          <ActivityIndicator color="#111111" />
        ) : (
          <Text style={authScreenStyles.buttonText}>Wachtwoord instellen</Text>
        )}
      </Pressable>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    gap: 14,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
  },
  loadingText: {
    color: "#5F5A54",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
