import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import type { Href } from "expo-router";
import React from "react";
import { ActivityIndicator, Pressable, Text, TextInput } from "react-native";
import { getAuthRedirectUrl } from "@/services/auth-url";
import { getEmailFeedback } from "@/services/auth-email-validation";

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useSession();
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const { emailValid, emailHint } = getEmailFeedback(email);

  const disabled = submitting || !emailValid;

  const handleRequestReset = async () => {
    if (disabled) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const redirectTo = getAuthRedirectUrl("/auth/reset-password");
      const { error: resetError } = await requestPasswordReset(
        email.trim(),
        redirectTo,
      );
      if (resetError) {
        setError(resetError.message || "Reset aanvragen mislukt.");
        return;
      }

      setSuccess(
        "Als dit account bestaat, is er een resetlink verstuurd naar je e-mail.",
      );
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Reset aanvragen mislukt.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      title="Wachtwoord vergeten"
      subtitle="We sturen een resetlink naar je e-mail zodat je veilig opnieuw toegang krijgt."
      links={[
        {
          href: "/auth/login" as Href,
          prompt: "Terug naar",
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
        onChangeText={(value) => {
          setEmail(value);
          if (error) setError(null);
          if (success) setSuccess(null);
        }}
        editable={!submitting}
      />
      {emailHint ? (
        <Text style={authScreenStyles.inlineHint}>{emailHint}</Text>
      ) : null}
      {error ? <Text style={authScreenStyles.errorText}>{error}</Text> : null}
      {success ? (
        <Text style={authScreenStyles.successText}>{success}</Text>
      ) : null}
      <Pressable
        style={[
          authScreenStyles.button,
          disabled && authScreenStyles.buttonDisabled,
        ]}
        onPress={handleRequestReset}
        disabled={disabled}
      >
        {submitting ? (
          <ActivityIndicator color="#07130D" />
        ) : (
          <Text style={authScreenStyles.buttonText}>Resetlink versturen</Text>
        )}
      </Pressable>
    </AuthScreenShell>
  );
}
