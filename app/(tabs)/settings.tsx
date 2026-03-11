import React from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { FinColors } from "@/constants/theme";

type RowProps = {
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

function SettingsRow({ label, subtitle, value, onPress, rightElement }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {rightElement ?? (
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? <Text style={styles.rowChevron}>{'>'}</Text> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const router = useRouter();
  const [darkMode, setDarkMode] = React.useState(true);

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>JD</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Jan de Vries</Text>
            <Text style={styles.profileEmail}>jan@example.com</Text>
          </View>
        </View>

        {/* Accounts */}
        <SectionHeader title="Accounts" />
        <View style={styles.card}>
          <SettingsRow
            label="Import transactions"
            subtitle="Upload a Rabobank CSV"
            onPress={() => router.push("/csv-import")}
          />
          <View style={styles.divider} />
          <SettingsRow
            label="Manage accounts"
            subtitle="Add or remove bank accounts"
            onPress={() => {}}
          />
        </View>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingsRow
            label="Currency"
            value="EUR"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            label="Appearance"
            subtitle="Dark mode enabled"
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: FinColors.bgElevated, true: FinColors.green }}
                thumbColor={FinColors.textPrimary}
              />
            }
          />
        </View>

        {/* Data */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <SettingsRow
            label="Export data"
            subtitle="Download all transactions as CSV"
            onPress={() => {}}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow label="Version" value="1.0.0" />
          <View style={styles.divider} />
          <SettingsRow label="Help & support" onPress={() => {}} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: "700", color: FinColors.textPrimary, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, gap: 8 },

  // Profile
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    backgroundColor: FinColors.bgCard,
    borderRadius: 18,
    padding: 22,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: FinColors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: FinColors.textSecondary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: "700", color: FinColors.textPrimary },
  profileEmail: { fontSize: 13, color: FinColors.textMuted, marginTop: 4 },

  // Section
  sectionHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 4,
    paddingTop: 20,
    paddingBottom: 10,
  },

  // Card
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  rowSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 4 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { fontSize: 14, color: FinColors.textSecondary, fontWeight: "500" },
  rowChevron: { fontSize: 16, color: FinColors.textMuted },
  divider: { height: 1, backgroundColor: FinColors.borderSubtle, marginLeft: 20 },

  // Sign out
  signOutBtn: {
    marginTop: 24,
    backgroundColor: FinColors.bgCard,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: FinColors.red,
  },
  signOutText: { fontSize: 15, fontWeight: "600", color: FinColors.red },
});
