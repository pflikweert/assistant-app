import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// --- fake data --------------------------------------------------------------
const fakeTransactions = [
  { id: '1', description: 'Coffee', date: '2026-03-10', amount: -3.5 },
  { id: '2', description: 'Salary', date: '2026-03-01', amount: 2500 },
  { id: '3', description: 'Groceries', date: '2026-02-28', amount: -76.23 },
  { id: '4', description: 'Electricity bill', date: '2026-02-25', amount: -120.0 },
  { id: '5', description: 'Streaming subscription', date: '2026-02-24', amount: -12.99 },
];

export default function DashboardScreen() {
  const balance = 5234.56;
  const safeToSpend = 234.78;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Balance</ThemedText>
        <ThemedText type="title" style={styles.amount}>
          ${balance.toFixed(2)}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Safe to spend today</ThemedText>
        <ThemedText type="defaultSemiBold" style={styles.amount}>
          ${safeToSpend.toFixed(2)}
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle">Recent transactions</ThemedText>
        {fakeTransactions.map((tx) => (
          <ThemedView key={tx.id} style={styles.transaction}>
            <ThemedText>{tx.description}</ThemedText>
            <ThemedText>{tx.date}</ThemedText>
            <ThemedText
              style={[
                styles.transactionAmount,
                { color: tx.amount < 0 ? '#d9534f' : '#5cb85c' },
              ]}
            >
              {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
            </ThemedText>
          </ThemedView>
        ))}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  amount: {
    marginTop: 4,
  },
  transaction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  transactionAmount: {
    fontWeight: '600',
  },
});
