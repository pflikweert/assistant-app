import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceInputField } from "@/components/ui/finance-input-field";
import type { Href } from "expo-router";
import { Link } from "expo-router";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getAuthSignInErrorMessage } from "@/services/auth-error-messages";

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
        setError(getAuthSignInErrorMessage(loginError));
      }
    } catch (loginError) {
      setError(getAuthSignInErrorMessage(loginError));
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
      <FinanceInputField
        label="E-mailadres"
        placeholder="naam@voorbeeld.nl"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
      />
      <View style={authScreenStyles.fieldGroup}>
        <FinanceInputField
          label="Wachtwoord"
          placeholder="Voer je wachtwoord in"
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
      <FinanceButton
        label="Inloggen"
        fullWidth
        onPress={handleLogin}
        disabled={disabled}
        loading={submitting}
      />
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
