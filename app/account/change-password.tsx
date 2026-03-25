import { useSession } from "@/app/_layout";
import {
  AuthScreenShell,
  authScreenStyles,
} from "@/components/auth/auth-screen-shell";
import { FinColors } from "@/constants/theme";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from "react-native";
import { getPasswordUpdateErrorMessage } from "@/services/auth-password-errors";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { updatePassword, user } = useSession();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const disabled =
    loading || password.trim().length < 8 || confirm.trim().length < 8;

  const handleSubmit = async () => {
    if (disabled) return;

    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen.");
      setSuccess(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        throw updateError;
      }

      setPassword("");
      setConfirm("");
      setSuccess("Je wachtwoord is bijgewerkt.");
      Alert.alert("Succes", "Je wachtwoord is gewijzigd.");
    } catch (updateError) {
      setError(
        getPasswordUpdateErrorMessage(updateError, "Wachtwoord wijzigen mislukt."),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <AuthScreenShell
        title="Wachtwoord wijzigen"
        subtitle={`Je bent ingelogd als ${user?.email ?? "deze gebruiker"}. Vul alleen je nieuwe wachtwoord in.`}
        links={[
          {
            href: "/(tabs)/settings" as Href,
            prompt: "Klaar of annuleren?",
            label: "Terug naar settings",
          },
        ]}
      >
        <TextInput
          style={authScreenStyles.input}
          placeholder="Nieuw wachtwoord"
          placeholderTextColor="#7E8A9A"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!loading}
        />
        <TextInput
          style={authScreenStyles.input}
          placeholder="Bevestig nieuw wachtwoord"
          placeholderTextColor="#7E8A9A"
          autoCapitalize="none"
          autoComplete="new-password"
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          editable={!loading}
        />
        <Text style={authScreenStyles.helperText}>
          Gebruik minimaal 8 tekens. Je huidige wachtwoord is hier niet nodig.
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
          onPress={handleSubmit}
          disabled={disabled}
        >
          {loading ? (
            <ActivityIndicator color={FinColors.bgBase} />
          ) : (
            <Text style={authScreenStyles.buttonText}>Wachtwoord wijzigen</Text>
          )}
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Annuleren</Text>
        </Pressable>
      </AuthScreenShell>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
  },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: FinColors.border,
    backgroundColor: FinColors.bgCard,
  },
  secondaryButtonText: {
    color: FinColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
});
