import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { FinColors } from "@/constants/theme";
import { useSession } from "@/app/_layout";
import {
    clearAllTransactionData,
    pauseBackgroundCategorization,
    resumeBackgroundCategorization,
    runRecategorizationForAllInBackground,
    stopBackgroundCategorization,
} from "@/services/categorization";
import {
    formatCategorizationStatus,
    useCategorizationStatus,
} from "@/services/categorization-status";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type RowProps = {
  iconName?: AppIconName;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

function ConfirmResetModal({
  visible,
  isClearing,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  isClearing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Alle data verwijderen</Text>
            <TouchableOpacity
              style={styles.modalIconCloseButton}
              onPress={onCancel}
              disabled={isClearing}
            >
              <AppIcon
                name="close"
                size={18}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            Dit zal alle transacties, categorisaties en auditlogs wissen. Dit
            kan niet ongedaan gemaakt worden. Ben je zeker?
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={onCancel}
              disabled={isClearing}
            >
              <Text style={styles.cancelButtonText}>Annuleren</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.deleteButton]}
              onPress={onConfirm}
              disabled={isClearing}
            >
              {isClearing ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.deleteButtonText}>Verwijderen</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SuccessModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>✓ Gereed</Text>
            <TouchableOpacity
              style={styles.modalIconCloseButton}
              onPress={onClose}
            >
              <AppIcon
                name="close"
                size={18}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            Alle transactiegegevens zijn gewist. Je kan nu nieuwe transacties
            importeren.
          </Text>
          <TouchableOpacity
            style={[styles.modalButton, styles.successButton]}
            onPress={onClose}
          >
            <Text style={styles.successButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ErrorModal({
  visible,
  error,
  onClose,
}: {
  visible: boolean;
  error: string | null;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Fout</Text>
            <TouchableOpacity
              style={styles.modalIconCloseButton}
              onPress={onClose}
            >
              <AppIcon
                name="close"
                size={18}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalText}>
            {error || "Kon gegevens niet wissen"}
          </Text>
          <TouchableOpacity
            style={[styles.modalButton, styles.errorButton]}
            onPress={onClose}
          >
            <Text style={styles.errorButtonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SettingsRow({
  label,
  subtitle,
  value,
  onPress,
  rightElement,
  iconName,
}: RowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {iconName ? (
        <View style={styles.rowIconWrap}>
          <AppIcon
            name={iconName}
            size={18}
            color={FinColors.textSecondary}
            variant="outlined"
          />
        </View>
      ) : null}
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {rightElement ?? (
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? (
            <AppIcon
              name="chevron-right"
              size={18}
              color={FinColors.textMuted}
              variant="outlined"
            />
          ) : null}
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
  const { logout, user } = useSession();
  const [isClearing, setIsClearing] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [showErrorModal, setShowErrorModal] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const backgroundStatus = useCategorizationStatus();

  const isBusy =
    backgroundStatus.phase === "queued" || backgroundStatus.phase === "running";
  const isPaused = backgroundStatus.phase === "paused";
  const backgroundSummary = isBusy
    ? "Categorisatie actief"
    : isPaused
      ? "Categorisatie gepauzeerd"
      : backgroundStatus.queuedCount > 0
        ? "Klaar om te hervatten"
        : "Alles bijgewerkt";
  const userEmail = user?.email || "Geen e-mail beschikbaar";
  const userName =
    String(
      user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email?.split("@")[0] ||
        "Gebruiker",
    ).trim() || "Gebruiker";
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const handleResetPress = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmReset = async () => {
    setIsClearing(true);
    try {
      await clearAllTransactionData();
      setShowConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Clear failed:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      setErrorMessage(errorMsg);
      setShowConfirmModal(false);
      setShowErrorModal(true);
    } finally {
      setIsClearing(false);
    }
  };

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await logout();
      router.replace("/auth/login" as Href);
    } catch (logoutError) {
      const logoutMessage =
        logoutError instanceof Error
          ? logoutError.message
          : "Uitloggen mislukt";
      setErrorMessage(logoutMessage);
      setShowErrorModal(true);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Instellingen</Text>
        <HeaderDropdownMenu />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{userInitials || "G"}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userName}</Text>
              <Text style={styles.profileEmail}>{userEmail}</Text>
            </View>
          </View>
          <View style={styles.profileMetaRow}>
            <View style={styles.profileStatusPill}>
              <Text style={styles.profileStatusPillText}>{backgroundSummary}</Text>
            </View>
            <Text style={styles.profileMetaText}>
              {backgroundStatus.updatedCount} transacties recent bijgewerkt
            </Text>
          </View>
        </View>

        <SectionHeader title="Import en accounts" />
        <View style={styles.card}>
          <SettingsRow
            iconName="upload-file"
            label="Transacties importeren"
            subtitle="Upload een Rabobank CSV"
            onPress={() => router.push("/csv-import")}
          />
          <View style={styles.divider} />
          <SettingsRow
            iconName="manage-accounts"
            label="Rekeningen beheren"
            subtitle="Bankrekeningen toevoegen of verwijderen"
            onPress={() => {}}
          />
           <View style={styles.divider} />
           <SettingsRow
             iconName="password"
             label="Wachtwoord wijzigen"
             subtitle="Wijzig je accountwachtwoord"
             onPress={() => router.push("/account/change-password")}
           />
        </View>

        <SectionHeader title="Voorkeuren" />
        <View style={styles.card}>
          <SettingsRow
            iconName="euro-symbol"
            label="Valuta"
            value="EUR"
            onPress={() => {}}
          />
          <SettingsRow
            iconName="palette"
            label="Weergave"
            value="Standaard"
            subtitle="Meer thema-opties volgen later"
          />
        </View>

        <SectionHeader title="Beheer" />
        <View style={styles.card}>
          <SettingsRow
            iconName="tune"
            label="Categorie-indeling"
            subtitle="Beheer wat onder vaste lasten, variabel of abonnementen valt"
            onPress={() => router.push("/category-budget-groups")}
          />
          <View style={styles.divider} />
          <SettingsRow
            iconName="subscriptions"
            label="Abonnementen"
            subtitle="Beheer profielen, PSP-koppelingen en regels"
            onPress={() => router.push("/subscriptions")}
          />
        </View>

        <SectionHeader title="Data" />
        <View style={styles.card}>
          <SettingsRow
            iconName="download"
            label="Data exporteren"
            subtitle="Download alle transacties als CSV"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <SettingsRow
            iconName="autorenew"
            label="Alles hercategoriseren"
            subtitle="Zet alle niet-handmatige transacties opnieuw door rules en OpenAI"
            onPress={() => runRecategorizationForAllInBackground()}
            rightElement={
              isBusy ? (
                <ActivityIndicator size="small" color={FinColors.green} />
              ) : undefined
            }
          />
          <View style={styles.divider} />
          <SettingsRow
            iconName="delete-outline"
            label="Transacties resetten"
            subtitle="Verwijder alle transactiegegevens en categorisaties"
            onPress={handleResetPress}
            rightElement={
              isClearing ? (
                <ActivityIndicator size="small" color={FinColors.green} />
              ) : undefined
            }
          />
        </View>

        <SectionHeader title="Achtergrondtaken" />
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Categorisatie</Text>
            <Text style={styles.statusPhase}>{backgroundStatus.phase}</Text>
          </View>
          <Text style={styles.statusText}>
            {formatCategorizationStatus(backgroundStatus)}
          </Text>
          <View style={styles.controlRow}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                (isPaused || !isBusy) && styles.controlButtonDisabled,
              ]}
              onPress={pauseBackgroundCategorization}
              disabled={isPaused || !isBusy}
            >
              <Text style={styles.controlButtonText}>Pauzeer</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.controlButton,
                !isPaused &&
                  !backgroundStatus.queuedCount &&
                  styles.controlButtonDisabled,
              ]}
              onPress={resumeBackgroundCategorization}
              disabled={!isPaused && !backgroundStatus.queuedCount}
            >
              <Text style={styles.controlButtonText}>Hervat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.controlButton,
                !isBusy && !isPaused && styles.controlButtonDisabled,
              ]}
              onPress={stopBackgroundCategorization}
              disabled={!isBusy && !isPaused}
            >
              <Text style={styles.controlButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statusMetaRow}>
            <Text style={styles.statusMetaText}>
              Verwerkt: {backgroundStatus.processedCount}
            </Text>
            <Text style={styles.statusMetaText}>
              Bijgewerkt: {backgroundStatus.updatedCount}
            </Text>
          </View>
          <View style={styles.statusMetaRow}>
            <Text style={styles.statusMetaText}>
              Rules: {backgroundStatus.ruleCount}
            </Text>
            <Text style={styles.statusMetaText}>
              OpenAI: {backgroundStatus.openAiCount}
            </Text>
          </View>
          <View style={styles.statusMetaRow}>
            <Text style={styles.statusMetaText}>
              Laatste mode: {backgroundStatus.lastRunMode || "-"}
            </Text>
            <Text style={styles.statusMetaText}>
              Overgeslagen: {backgroundStatus.skippedCount}
            </Text>
          </View>
          {backgroundStatus.lastError ? (
            <Text style={styles.statusError}>
              Laatste fout: {backgroundStatus.lastError}
            </Text>
          ) : null}
          {backgroundStatus.lastCompletedAt ? (
            <Text style={styles.statusTimestamp}>
              Laatste afronding:{" "}
              {new Date(backgroundStatus.lastCompletedAt).toLocaleString(
                "nl-NL",
              )}
            </Text>
          ) : null}
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <View style={styles.card}>
          <SettingsRow iconName="info-outline" label="Versie" value="1.0.0" />
          <View style={styles.divider} />
          <SettingsRow
            iconName="support-agent"
            label="Hulp en support"
            onPress={() => {}}
          />
        </View>

        <TouchableOpacity
          style={styles.signOutBtn}
          activeOpacity={0.7}
          onPress={handleLogout}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color={FinColors.red} />
          ) : (
            <Text style={styles.signOutText}>Uitloggen</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <ConfirmResetModal
        visible={showConfirmModal}
        isClearing={isClearing}
        onConfirm={handleConfirmReset}
        onCancel={() => setShowConfirmModal(false)}
      />
      <SuccessModal
        visible={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
      />
      <ErrorModal
        visible={showErrorModal}
        error={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase },
  topBar: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 48, gap: 8 },

  // Profile
  profileCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 18,
    padding: 22,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    gap: 14,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: FinColors.bgElevated,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  profileEmail: { fontSize: 13, color: FinColors.textMuted, marginTop: 4 },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  profileStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: FinColors.greenBg,
    borderWidth: 1,
    borderColor: FinColors.greenBorder,
  },
  profileStatusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.green,
  },
  profileMetaText: {
    fontSize: 12,
    color: FinColors.textSecondary,
    flexShrink: 1,
  },

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
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600", color: FinColors.textPrimary },
  rowSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 4 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { fontSize: 14, color: FinColors.textSecondary, fontWeight: "500" },
  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 20,
  },

  statusCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  statusPhase: {
    fontSize: 12,
    color: FinColors.green,
    textTransform: "uppercase",
    fontWeight: "700",
  },
  statusText: {
    fontSize: 13,
    color: FinColors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
  },
  controlRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  controlButtonDisabled: {
    opacity: 0.45,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  statusMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 12,
  },
  statusMetaText: { fontSize: 12, color: FinColors.textMuted },
  statusError: {
    fontSize: 12,
    color: FinColors.red,
    marginTop: 12,
    lineHeight: 18,
  },
  statusTimestamp: { fontSize: 12, color: FinColors.textMuted, marginTop: 12 },

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

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  modalIconCloseButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  modalText: {
    fontSize: 14,
    color: FinColors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  deleteButton: {
    backgroundColor: FinColors.red,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  successButton: {
    backgroundColor: FinColors.green,
  },
  successButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  errorButton: {
    backgroundColor: FinColors.red,
  },
  errorButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
});
