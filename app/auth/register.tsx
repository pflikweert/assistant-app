import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import type { Href } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput } from "react-native";

export default function RegisterScreen() {
  const { register } = useSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const disabled =
    submitting ||
    !email.trim() ||
    password.length < 8 ||
    confirmPassword.length < 8;

  const handleRegister = async () => {
    if (disabled) return;
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen.");
      setSuccess(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const { data, error: registerError } = await register(
        email.trim(),
        password,
      );
      if (registerError) {
        setError(registerError.message || "Registratie mislukt.");
        return;
      }

      setSuccess(
        data.session
          ? "Account aangemaakt. Je bent ingelogd."
          : "Account aangemaakt. Controleer je e-mail om het account te bevestigen.",
      );
    } catch (registerError) {
      setError(
        registerError instanceof Error
          ? registerError.message
          : "Registratie mislukt.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      title="Nieuw account"
      subtitle="Maak een account aan zodat je data per gebruiker en rekening geïsoleerd blijft."
      links={[
        {
          href: "/auth/login" as Href,
          prompt: "Al een account?",
          label: "Inloggen",
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
        placeholder="Wachtwoord (minimaal 8 tekens)"
        placeholderTextColor="#7E8A9A"
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!submitting}
      />
      <TextInput
        style={authScreenStyles.input}
        placeholder="Herhaal wachtwoord"
        placeholderTextColor="#7E8A9A"
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!submitting}
      />
      <Text style={authScreenStyles.helperText}>
        Gebruik een uniek wachtwoord. MFA kunnen we hierna als extra stap toevoegen.
      </Text>
      {error ? <Text style={authScreenStyles.errorText}>{error}</Text> : null}
      {success ? (
        <Text style={authScreenStyles.successText}>{success}</Text>
      ) : null}
      <Pressable
        style={[
          authScreenStyles.button,
          disabled && authScreenStyles.buttonDisabled,
        ]}
        onPress={handleRegister}
        disabled={disabled}
      >
        {submitting ? (
          <ActivityIndicator color="#07130D" />
        ) : (
          <Text style={authScreenStyles.buttonText}>Account aanmaken</Text>
        )}
      </Pressable>
    </AuthScreenShell>
  );
}
