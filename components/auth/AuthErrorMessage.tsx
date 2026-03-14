import React from 'react';
import { View, Text, Button } from 'react-native';

export type AuthErrorCode =
  | 'otp_expired'
  | 'invalid_token'
  | 'access_denied'
  | 'invalid_email'
  | 'unknown';

const errorMessages: Record<AuthErrorCode, string> = {
  otp_expired: 'De link is verlopen of al gebruikt. Vraag een nieuwe reset aan.',
  invalid_token: 'De link is ongeldig of al gebruikt. Vraag een nieuwe reset aan.',
  access_denied: 'Toegang geweigerd. Vraag een nieuwe reset aan.',
  invalid_email: 'Dit e-mailadres is niet bekend.',
  unknown: 'Er is iets misgegaan. Probeer het opnieuw of vraag een nieuwe reset aan.',
};

export function getAuthErrorMessage(code?: string, description?: string) {
  if (!code) return errorMessages.unknown;
  if (errorMessages[code as AuthErrorCode]) return errorMessages[code as AuthErrorCode];
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
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24, flex: 1 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16, color: 'red', textAlign: 'center' }}>
        Wachtwoord resetten niet mogelijk
      </Text>
      <Text style={{ marginBottom: 24, textAlign: 'center' }}>
        {getAuthErrorMessage(code, description)}
      </Text>
      <Button title="Vraag nieuw wachtwoord aan" onPress={onReset} />
    </View>
  );
}
