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
  icon: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

function SettingsRow({ label, subtitle, icon, value, onPress, rightElement }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <View style={styles.rowIcon}>
        <Text style={{ fontSize: 16, color: FinColors.green }}>{icon}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {rightElement ?? (
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? <Text style={styles.rowChevron}>›</Text> : null}
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
      {/* Profile header */}
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={{ fontSize: 24, fontWeight: "800", color: "#0f172a" }}>JD</Text>
          </View>
          <View>
            <Text style={styles.profileName}>Jan de Vries</Text>
            <Text style={styles.profileEmail}>jan@example.com</Text>
          </View>
        </View>

        {/* Accounts */}
        <SectionHeader title="Accounts" />
        <View style={styles.card}>
          <SettingsRow
            icon="↑"
            label="Import transactions"
            subtitle="Upload a Rabobank CSV"
            onPress={() => router.push("/csv-import")}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="⊕"
            label="Manage accounts"
            subtitle="Add or remove bank accounts"
            onPress={() => {}}
          />
        </View>

        {/* Preferences */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingsRow
            icon="€"
            label="Currency"
            value="EUR"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon="◑"
            label="Theme"
            subtitle="Dark mode is active"
            rightElement={
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: FinColors.bgElevated, true: FinColors.greenBorder }}
                thumbColor={darkMode ? FinColors.green : FinColors.textMuted}
              />
            }
          />
        </View>

        {/* Data */}
        <SectionHeader title="Data" />
        <View style={styles.card}>
          <SettingsRow
            icon="↓"
            label="Data export"
            subtitle="Download all your transactions"
            onPress={() => {}}
          />
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow icon="i" label="Version" value="1.0.0" />
          <View style={styles.divider} />
          <SettingsRow icon="?" label="Help & support" onPress={() => {}} />
        </View>

        {/* Danger zone */}
        <SectionHeader title="Account" />
        <View style={[styles.card, { borderColor: FinColors.redBg }]}>
          <TouchableOpacity style={styles.row} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: FinColors.redBg }]}>
              <Text style={{ fontSize: 15, color: FinColors.red }}>×</Text>
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowLabel, { color: FinColors.red }]}>Sign out</Text>
            </View>
            <Text style={[styles.rowChevron, { color: FinColors.red }]}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: FinColors.textPrimary },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 6 },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: FinColors.bgCard,
    borderRadius: 18,
    padding: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: FinColors.green,
    justifyContent: "center",
    alignItems: "center",
  },
  profileName: { fontSize: 17, fontWeight: "700", color: FinColors.textPrimary },
  profileEmail: { fontSize: 12, color: FinColors.textMuted, marginTop: 3 },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 6,
  },
  card: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: FinColors.greenBg,
    justifyContent: "center",
    alignItems: "center",
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: FinColors.textPrimary },
  rowSub: { fontSize: 11, color: FinColors.textMuted, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 13, color: FinColors.textSecondary, fontWeight: "600" },
  rowChevron: { fontSize: 20, color: FinColors.textMuted, lineHeight: 22 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: FinColors.borderSubtle, marginLeft: 66 },
});
