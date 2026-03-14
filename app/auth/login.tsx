import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import type { Href } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

export default function LoginScreen() {
  const { login, loading } = useSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const disabled = loading || submitting || !email.trim() || !password;

  const handleLogin = async () => {
    if (disabled) return;
    setSubmitting(true);
    setError(null);

    try {
      const { error: loginError } = await login(email.trim(), password);
      if (loginError) {
        setError(loginError.message || "Inloggen mislukt.");
      }
    } catch (loginError) {
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Inloggen mislukt.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      title="Welkom terug"
      subtitle="Log in om je transacties, budgetten en inzichten veilig per account te beheren."
      links={[
        {
          href: "/auth/register" as Href,
          prompt: "Nog geen account?",
          label: "Registreren",
        },
        {
          href: "/auth/forgot-password" as Href,
          prompt: "Wachtwoord vergeten?",
          label: "Reset aanvragen",
        },
      ]}
    >
      <TextInput
        style={authScreenStyles.input}
        placeholder="E-mail"
        placeholderTextColor="#7E8A9A"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
      />
      <TextInput
        style={authScreenStyles.input}
        placeholder="Wachtwoord"
        placeholderTextColor="#7E8A9A"
        autoCapitalize="none"
        autoComplete="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!submitting}
      />
      {error ? <Text style={authScreenStyles.errorText}>{error}</Text> : null}
      <Pressable
        style={[
          authScreenStyles.button,
          disabled && authScreenStyles.buttonDisabled,
        ]}
        onPress={handleLogin}
        disabled={disabled}
      >
        {submitting ? (
          <ActivityIndicator color="#07130D" />
        ) : (
          <Text style={authScreenStyles.buttonText}>Inloggen</Text>
        )}
      </Pressable>
      <Text style={styles.metaText}>
        Sessies worden veilig opgeslagen op het device en automatisch hersteld.
      </Text>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  metaText: {
    color: "#7E8A9A",
    fontSize: 13,
    lineHeight: 19,
  },
});
