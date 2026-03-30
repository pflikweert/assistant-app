import React from "react";
import type { Href } from "expo-router";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import { FinanceButton } from "@/components/ui/finance-button";

export type AuthErrorCode =
  | "otp_expired"
  | "invalid_token"
  | "access_denied"
  | "invalid_email"
  | "unknown";

const errorMessages: Record<AuthErrorCode, string> = {
  otp_expired:
    "Deze link is verlopen of al gebruikt. Vraag een nieuwe resetlink aan.",
  invalid_token:
    "Deze link is ongeldig of al gebruikt. Vraag een nieuwe resetlink aan.",
  access_denied: "Toegang geweigerd. Vraag een nieuwe resetlink aan.",
  invalid_email: "Dit e-mailadres is niet bekend.",
  unknown:
    "Er is iets misgegaan. Probeer het opnieuw of vraag een nieuwe resetlink aan.",
};

export function getAuthErrorMessage(code?: string, description?: string) {
  if (!code) return errorMessages.unknown;
  if (errorMessages[code as AuthErrorCode]) {
    return errorMessages[code as AuthErrorCode];
  }
  if (description) return decodeURIComponent(description);
  return errorMessages.unknown;
}

export default function AuthErrorMessage({
  code,
  description,
  onReset,
}: {
  code?: string;
  description?: string;
  onReset: () => void;
}) {
  const message = getAuthErrorMessage(code, description);
  const isInvalidEmail = code === "invalid_email";

  return (
    <AuthScreenShell
      title={isInvalidEmail ? "E-mailadres niet gevonden" : "Wachtwoordlink verlopen"}
      subtitle={
        isInvalidEmail
          ? "Controleer het e-mailadres en probeer het opnieuw."
          : "Vraag een nieuwe link aan om je wachtwoord opnieuw in te stellen."
      }
      links={[
        {
          href: "/auth/login" as Href,
          prompt: "Terug naar",
          label: "Inloggen",
        },
      ]}
    >
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>
          {isInvalidEmail ? "Controleer je e-mailadres" : "Link niet meer geldig"}
        </Text>
        <Text style={styles.noticeBody}>{message}</Text>
      </View>

      <FinanceButton
        label="Vraag nieuwe resetlink aan"
        fullWidth
        onPress={onReset}
      />

      <Text style={styles.helperText}>
        Je kunt daarna direct opnieuw een wachtwoord instellen.
      </Text>

      <Text style={styles.secondaryRow}>
        Problemen met de link?{" "}
        <Link href={"/auth/login" as Href} style={authScreenStyles.textLink}>
          Terug naar inloggen
        </Link>
      </Text>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  noticeCard: {
    gap: 10,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.76)",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.06)",
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  noticeTitle: {
    color: "#111111",
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  noticeBody: {
    color: "#5F5A54",
    fontSize: 15,
    lineHeight: 22,
  },
  helperText: {
    color: "#8F8A83",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  secondaryRow: {
    color: "#5F5A54",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    paddingHorizontal: 8,
  },
});
