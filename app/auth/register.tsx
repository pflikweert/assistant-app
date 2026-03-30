import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceInputField } from "@/components/ui/finance-input-field";
import type { Href } from "expo-router";
import React from "react";
import { Text } from "react-native";
import { getAuthRedirectUrl } from "@/services/auth-url";
import { getAuthRegistrationErrorMessage } from "@/services/auth-error-messages";
import { getEmailFeedback } from "@/services/auth-email-validation";
import {
  getPasswordFeedback,
  getPasswordRequirementsText,
} from "@/services/auth-password-validation";

export default function RegisterScreen() {
  const { register } = useSession();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [nameTouched, setNameTouched] = React.useState(false);
  const [emailTouched, setEmailTouched] = React.useState(false);
  const [passwordTouched, setPasswordTouched] = React.useState(false);
  const [confirmTouched, setConfirmTouched] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const nameValid = name.trim().length > 0;
  const nameHint = nameTouched && !nameValid ? "Vul je naam in." : null;
  const { emailValid, emailHint: rawEmailHint } = getEmailFeedback(email);
  const {
    passwordValid,
    confirmValid,
    passwordsMatch,
    passwordHint,
    confirmHint,
  } = getPasswordFeedback(password, confirmPassword);
  const emailHint = emailTouched && !emailValid ? rawEmailHint : null;
  const passwordInlineHint = passwordTouched ? passwordHint : null;
  const confirmInlineHint = confirmTouched ? confirmHint : null;

  const disabled =
    submitting ||
    !nameValid ||
    !emailValid ||
    !passwordValid ||
    !confirmValid;

  const handleRegister = async () => {
    if (disabled) return;
    if (!passwordsMatch) {
      setError("Wachtwoorden komen niet overeen.");
      setSuccess(null);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const emailRedirectTo = getAuthRedirectUrl("/auth/login");
      const { data, error: registerError } = await register(
        email.trim(),
        password,
        emailRedirectTo,
        name.trim(),
      );
      if (registerError) {
        setError(getAuthRegistrationErrorMessage(registerError));
        return;
      }

      setSuccess(
        data.session
          ? "Account aangemaakt. Je bent ingelogd."
          : "Account aangemaakt. Controleer je e-mail om het account te bevestigen.",
      );
    } catch (registerError) {
      setError(getAuthRegistrationErrorMessage(registerError));
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
      <FinanceInputField
        label="Naam"
        placeholder="Je naam"
        autoCapitalize="words"
        autoComplete="name"
        value={name}
        onChangeText={(value) => {
          setName(value);
          setNameTouched(true);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        editable={!submitting}
        hint={nameHint}
      />
      <FinanceInputField
        label="E-mail"
        placeholder="E-mail"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setEmailTouched(true);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        editable={!submitting}
        hint={emailHint}
      />
      <FinanceInputField
        label="Wachtwoord"
        placeholder="Wachtwoord"
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setPasswordTouched(true);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        editable={!submitting}
        hint={passwordInlineHint}
      />
      <FinanceInputField
        label="Herhaal wachtwoord"
        placeholder="Herhaal wachtwoord"
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          setConfirmTouched(true);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        editable={!submitting}
        hint={confirmInlineHint}
      />
      <Text style={authScreenStyles.helperText}>
        {getPasswordRequirementsText()}
      </Text>
      {error ? <Text style={authScreenStyles.errorText}>{error}</Text> : null}
      {success ? (
        <Text style={authScreenStyles.successText}>{success}</Text>
      ) : null}
      <FinanceButton
        label="Account aanmaken"
        fullWidth
        onPress={handleRegister}
        disabled={disabled}
        loading={submitting}
      />
    </AuthScreenShell>
  );
}
