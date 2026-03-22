import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import type { Href } from "expo-router";
import { Link } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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
      ]}
    >
      <Text style={styles.securityNote}>
        Je sessie blijft veilig opgeslagen op dit apparaat.
      </Text>
      <Text style={authScreenStyles.fieldLabel}>E-mailadres</Text>
      <TextInput
        style={authScreenStyles.input}
        placeholder="naam@voorbeeld.nl"
        placeholderTextColor="#8F8A83"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
      />
      <View style={authScreenStyles.fieldGroup}>
        <Text style={authScreenStyles.fieldLabel}>Wachtwoord</Text>
        <TextInput
          style={authScreenStyles.input}
          placeholder="Voer je wachtwoord in"
          placeholderTextColor="#8F8A83"
          autoCapitalize="none"
          autoComplete="password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!submitting}
        />
        <Link
          href={"/auth/forgot-password" as Href}
          style={[authScreenStyles.textLink, styles.forgotLink]}
        >
          Wachtwoord vergeten?
        </Link>
      </View>
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
          <ActivityIndicator color="#111111" />
        ) : (
          <Text style={authScreenStyles.buttonText}>Inloggen</Text>
        )}
      </Pressable>
      <Text style={styles.metaText}>
        Je accountgegevens blijven gekoppeld aan je eigen omgeving en worden
        automatisch hersteld bij een volgende sessie.
      </Text>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  securityNote: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    color: "#5F5A54",
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  metaText: {
    color: "#8F8A83",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  forgotLink: {
    alignSelf: "flex-end",
    marginTop: -2,
  },
});
