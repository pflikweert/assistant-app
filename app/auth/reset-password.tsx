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
import { supabase } from "@/services/supabase";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const error =
    typeof params.error === "string" ? params.error : undefined;
  const errorCode =
    typeof params.error_code === "string" ? params.error_code : undefined;
  const errorDescription =
    typeof params.error_description === "string"
      ? params.error_description
      : undefined;

  const disabled =
    loading ||
    sessionLoading ||
    !session ||
    password.length < 8 ||
    confirm.length < 8;

  useEffect(() => {
    let mounted = true;
    const getSessionFromUrl = (supabase.auth as any).getSessionFromUrl;
    if (typeof getSessionFromUrl !== "function") {
      setSession(null);
      setSessionError("invalid_token");
      setSessionLoading(false);
      return () => {
        mounted = false;
      };
    }

    getSessionFromUrl({ storeSession: true })
      .then(({ data }: { data: { session: Session | null } }) => {
        if (!mounted) return;
        if (data.session) {
          setSession(data.session);
          setSessionError(null);
        } else {
          setSession(null);
          setSessionError("invalid_token");
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setSessionError("invalid_token");
      })
      .finally(() => {
        if (!mounted) return;
        setSessionLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (disabled) return;
    if (!session) {
      Alert.alert(
        "Onjuiste link",
        "De resetlink is verlopen of ongeldig. Vraag een nieuwe link aan.",
      );
      return;
    }
    if (password !== confirm) {
      Alert.alert("Wachtwoorden komen niet overeen.");
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
      const message =
        err instanceof Error ? err.message : "Wachtwoord resetten mislukt.";
      Alert.alert("Fout", message);
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
    error ||
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
        onChangeText={setPassword}
        editable={!loading}
      />
      <Text style={authScreenStyles.fieldLabel}>Bevestig wachtwoord</Text>
      <TextInput
        style={authScreenStyles.input}
        placeholder="Herhaal het wachtwoord"
        placeholderTextColor="#8F8A83"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        editable={!loading}
      />
      <Text style={authScreenStyles.helperText}>
        Gebruik minimaal 8 tekens. Je huidige wachtwoord is hier niet nodig.
      </Text>
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
