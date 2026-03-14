import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, TextInput, Button, Alert } from 'react-native';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!password || password.length < 8) {
      Alert.alert('Wachtwoord te kort', 'Minimaal 8 tekens.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Wachtwoorden komen niet overeen');
      return;
    }
    setLoading(true);
    try {
      // TODO: Vervang door echte API-call
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, password }),
      });
      if (!res.ok) throw new Error('Wijzigen mislukt');
      Alert.alert('Succes', 'Wachtwoord gewijzigd.');
      router.back();
    } catch (e) {
      Alert.alert('Fout', 'Wachtwoord wijzigen mislukt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: 'bold', marginBottom: 16 }}>Wachtwoord wijzigen</Text>
      <TextInput
        placeholder="Huidig wachtwoord"
        secureTextEntry
        value={current}
        onChangeText={setCurrent}
        style={{ marginBottom: 12, borderBottomWidth: 1, padding: 8 }}
      />
      <TextInput
        placeholder="Nieuw wachtwoord"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ marginBottom: 12, borderBottomWidth: 1, padding: 8 }}
      />
      <TextInput
        placeholder="Bevestig nieuw wachtwoord"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={{ marginBottom: 24, borderBottomWidth: 1, padding: 8 }}
      />
      <Button title={loading ? 'Bezig...' : 'Wachtwoord wijzigen'} onPress={handleSubmit} disabled={loading} />
    </View>
  );
}
