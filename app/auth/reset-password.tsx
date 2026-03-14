import React, { useEffect, useState } from "react";
import type { Href } from "expo-router";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import AuthErrorMessage from "@/components/auth/AuthErrorMessage";
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

      const response = await fetch("/api/auth/reset-password-log", {
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
      });

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
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12, color: "#7E8A9A" }}>
          Bezig met het valideren van je resetlink…
        </Text>
      </View>
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
    <View style={{ padding: 24 }}>
      <Text
        style={{ fontSize: 22, fontWeight: "bold", marginBottom: 16 }}
      >
        Nieuw wachtwoord instellen
      </Text>
      <TextInput
        placeholder="Nieuw wachtwoord"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ marginBottom: 12, borderBottomWidth: 1, padding: 8 }}
        editable={!loading}
      />
      <TextInput
        placeholder="Bevestig wachtwoord"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={{ marginBottom: 24, borderBottomWidth: 1, padding: 8 }}
        editable={!loading}
      />
      <Button
        title={loading ? "Bezig..." : "Wachtwoord instellen"}
        onPress={handleSubmit}
        disabled={disabled}
      />
    </View>
  );
}
