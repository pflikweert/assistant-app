import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { FinColors } from '@/constants/theme';

// Override DarkTheme with our fintech palette
const FinTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: FinColors.bgBase,
    card: FinColors.bgCard,
    text: FinColors.textPrimary,
    border: FinColors.borderSubtle,
    primary: FinColors.green,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={FinTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: FinColors.bgCard },
          headerTintColor: FinColors.textPrimary,
          headerTitleStyle: { fontWeight: '700', color: FinColors.textPrimary },
          contentStyle: { backgroundColor: FinColors.bgBase },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transactions" options={{ title: 'All Transactions', headerShown: true }} />
        <Stack.Screen name="csv-import" options={{ title: 'Import Transactions', headerShown: true }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Info' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
