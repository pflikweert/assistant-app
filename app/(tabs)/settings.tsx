import { AppIcon } from "@/components/ui/app-icon";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { FinanceAvatarBadge } from "@/components/ui/finance-avatar-badge";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceSettingsRow } from "@/components/ui/finance-settings-row";
import { FinanceUtilityShell } from "@/components/ui/finance-utility-shell";
import {
  FinanceQuickMenu,
  type FinanceQuickMenuKey,
} from "@/components/navigation/finance-quick-menu";
import { useSession } from "@/app/_layout";
import { useAdminAccess } from "@/services/admin-access";
import {
    clearQueuedCategorizationQueue,
    clearTransactionData,
    pauseBackgroundCategorization,
    resumeBackgroundCategorization,
    runRecategorizationForAllInBackground,
    stopBackgroundCategorization,
} from "@/services/categorization";
import {
    formatCategorizationStatus,
    useCategorizationStatus,
} from "@/services/categorization-status";
import {
  ensureForecastFresh,
  getForecastRefreshStatus,
  resetAndRecomputeForecast,
} from "@/services/forecast-refresh";
import {
  resolveTransactionCleanupScopeInfo,
  type TransactionCleanupScope,
} from "@/services/transaction-data-cleanup";
import type { ForecastRefreshStatus } from "@/types/categorization";
import type { Href } from "expo-router";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

function CleanupScopeSheet({
  visible,
  currentMonthLabel,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  currentMonthLabel: string;
  onSelect: (scope: TransactionCleanupScope) => void;
  onCancel: () => void;
}) {
  return (
    <FinanceBottomSheetShell
      visible={visible}
      title="Transacties opschonen"
      subtitle="Kies of je alleen de huidige maand wilt verwijderen of alles."
      onClose={onCancel}
    >
      <View style={styles.cleanupChoiceCard}>
        <FinanceSettingsRow
          iconName="event"
          label="Huidige maand"
          subtitle={`Verwijder alle transacties van ${currentMonthLabel}.`}
          onPress={() => onSelect("current_month")}
        />
        <View style={styles.divider} />
        <FinanceSettingsRow
          iconName="delete-outline"
          label="Alles"
          subtitle="Verwijder alle transacties, categorisaties en auditlogs."
          onPress={() => onSelect("all")}
        />
      </View>
      <Text style={styles.cleanupHint}>
        De huidige maand is de kalendermaand op dit moment.
      </Text>
    </FinanceBottomSheetShell>
  );
}

function ConfirmCleanupModal({
  visible,
  isClearing,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  isClearing: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{title}</Text>
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
          <Text style={styles.modalText}>{body}</Text>
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
                <Text style={styles.deleteButtonText}>{confirmLabel}</Text>
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
  message,
  onClose,
}: {
  visible: boolean;
  message: string;
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
          <Text style={styles.modalText}>{message}</Text>
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

export default function SettingsScreen() {
  const router = useRouter();
  const { logout, user } = useSession();
  const adminAccess = useAdminAccess();
  const [isClearing, setIsClearing] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [showCleanupScopeSheet, setShowCleanupScopeSheet] =
    React.useState(false);
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [showErrorModal, setShowErrorModal] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string>("");
  const [isRefreshingForecast, setIsRefreshingForecast] = React.useState(false);
  const [isResettingForecast, setIsResettingForecast] = React.useState(false);
  const [showForecastResetConfirmModal, setShowForecastResetConfirmModal] =
    React.useState(false);
  const [showForecastResetSuccessModal, setShowForecastResetSuccessModal] =
    React.useState(false);
  const [showForecastResetErrorModal, setShowForecastResetErrorModal] =
    React.useState(false);
  const [forecastResetErrorMessage, setForecastResetErrorMessage] =
    React.useState<string | null>(null);
  const [forecastResetSuccessMessage, setForecastResetSuccessMessage] =
    React.useState("");
  const [cleanupScope, setCleanupScope] =
    React.useState<TransactionCleanupScope>("current_month");
  const [forecastRefreshStatus, setForecastRefreshStatus] =
    React.useState<ForecastRefreshStatus | null>(null);
  const backgroundStatus = useCategorizationStatus();
  const cleanupScopeInfo = React.useMemo(
    () => resolveTransactionCleanupScopeInfo(cleanupScope),
    [cleanupScope],
  );

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
  const forecastSummary = React.useMemo(() => {
    if (isRefreshingForecast) return "Forecast wordt opnieuw berekend";
    if (!forecastRefreshStatus) return "Refreshstatus wordt geladen";
    if (forecastRefreshStatus.lastError) {
      return "Laatste refresh had een fout";
    }
    if (forecastRefreshStatus.isDirty) {
      return "Forecast wacht op herberekening";
    }
    if (forecastRefreshStatus.lastComputedAt) {
      return `Laatst berekend op ${new Date(
        forecastRefreshStatus.lastComputedAt,
      ).toLocaleString("nl-NL")}`;
    }
    return "Nog niet berekend";
  }, [forecastRefreshStatus, isRefreshingForecast]);

  const loadForecastStatus = React.useCallback(async () => {
    try {
      const status = await getForecastRefreshStatus();
      setForecastRefreshStatus(status);
    } catch (error) {
      console.warn("[settings] forecast refresh status load failed", error);
    }
  }, []);

  React.useEffect(() => {
    void loadForecastStatus();
  }, [loadForecastStatus]);

  const handleResetPress = () => {
    setShowCleanupScopeSheet(true);
  };

  const handleSelectCleanupScope = (scope: TransactionCleanupScope) => {
    setCleanupScope(scope);
    setShowCleanupScopeSheet(false);
    setShowConfirmModal(true);
  };

  const handleConfirmReset = async () => {
    setIsClearing(true);
    try {
      const message = await clearTransactionData(cleanupScope);
      setSuccessMessage(message);
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

  const handleRefreshForecast = async () => {
    if (isRefreshingForecast) return;
    setIsRefreshingForecast(true);
    try {
      const status = await ensureForecastFresh({
        reason: "manual_refresh",
        referenceDate: new Date(),
        force: true,
      });
      setForecastRefreshStatus(status);
    } catch (refreshError) {
      const refreshMessage =
        refreshError instanceof Error
          ? refreshError.message
          : "Forecast opnieuw berekenen mislukt";
      setErrorMessage(refreshMessage);
      setShowErrorModal(true);
      await loadForecastStatus();
    } finally {
      setIsRefreshingForecast(false);
    }
  };

  const handleResetForecast = () => {
    if (isResettingForecast) return;
    setShowForecastResetConfirmModal(true);
  };

  const handleConfirmResetForecast = async () => {
    if (isResettingForecast) return;
    setIsResettingForecast(true);
    try {
      const status = await resetAndRecomputeForecast({
        reason: "manual_refresh",
        referenceDate: new Date(),
      });
      setForecastRefreshStatus(status);
      setForecastResetSuccessMessage(
        "De forecast is gewist en opnieuw berekend.",
      );
      setShowForecastResetConfirmModal(false);
      setShowForecastResetSuccessModal(true);
    } catch (resetError) {
      const resetMessage =
        resetError instanceof Error
          ? resetError.message
          : "Forecast opnieuw opbouwen mislukt";
      setForecastResetErrorMessage(resetMessage);
      setShowForecastResetConfirmModal(false);
      setShowForecastResetErrorModal(true);
      await loadForecastStatus();
    } finally {
      setIsResettingForecast(false);
    }
  };

  return (
    <FinanceUtilityShell
      title="Instellingen"
      rightSlot={<FinanceAvatarBadge />}
      contentContainerStyle={styles.scroll}
      hero={{
        eyebrow: "Account",
        title: "Instellingen",
        subtitle: "Beheer je account, data en forecast vanuit één plek.",
        shellStyle: styles.heroShell,
      }}
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

      <View style={styles.contentMax}>
        <FinanceSettingsGroup title="Import en accounts">
          <FinanceSettingsRow
            iconName="upload-file"
            label="Transacties importeren"
            subtitle="Upload een export van je bank"
            onPress={() => router.push("/csv-import")}
          />
          <View style={styles.divider} />
          <FinanceSettingsRow
            iconName="manage-accounts"
            label="Rekeningen beheren"
            subtitle="Bankrekeningen toevoegen, bewerken of verwijderen"
            onPress={() => router.push("/bankrekeningen")}
          />
          <View style={styles.divider} />
          <FinanceSettingsRow
            iconName="password"
            label="Wachtwoord wijzigen"
            subtitle="Wijzig je accountwachtwoord"
            onPress={() => router.push("/settings/security/password")}
          />
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Voorkeuren">
          <FinanceSettingsRow
            iconName="euro-symbol"
            label="Valuta"
            value="EUR"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <FinanceSettingsRow
            iconName="palette"
            label="Weergave"
            value="Standaard"
            subtitle="Meer thema-opties volgen later"
          />
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Beheer">
          {adminAccess.loading ? null : adminAccess.isAdmin ? (
            <>
              <FinanceSettingsRow
                iconName="shield"
                label="Budio beheer"
                subtitle="Assistent review, AI-verbruik en route-instellingen"
                onPress={() => router.push("/admin" as Href)}
              />
              <View style={styles.divider} />
            </>
          ) : null}
          <FinanceSettingsRow
            iconName="tune"
            label="Categorie-indeling"
            subtitle="Beheer wat onder vaste lasten, variabel of abonnementen valt"
            onPress={() => router.push("/category-budget-groups")}
          />
          <View style={styles.divider} />
          <FinanceSettingsRow
            iconName="subscriptions"
            label="Abonnementen"
            subtitle="Beheer profielen, PSP-koppelingen en regels"
            onPress={() => router.push("/subscriptions")}
          />
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Forecast">
          <FinanceSettingsRow
            iconName="autorenew"
            label="Forecast opnieuw berekenen"
            subtitle={forecastSummary}
            onPress={handleRefreshForecast}
            rightElement={
              isRefreshingForecast ? (
                <ActivityIndicator size="small" color={FinColors.green} />
              ) : undefined
            }
          />
          {adminAccess.loading ? null : adminAccess.isAdmin ? (
            <>
              <View style={styles.divider} />
              <FinanceSettingsRow
                iconName="delete-outline"
                label="Forecast opnieuw opbouwen"
                subtitle="Wis forecastdata en bereken meteen opnieuw"
                onPress={handleResetForecast}
                rightElement={
                  isResettingForecast ? (
                    <ActivityIndicator
                      size="small"
                      color={FinColors.green}
                    />
                  ) : undefined
                }
              />
            </>
          ) : null}
          {forecastRefreshStatus?.lastError ? (
            <>
              <View style={styles.divider} />
              <View style={styles.inlineNote}>
                <Text style={styles.inlineNoteError}>
                  Laatste fout: {forecastRefreshStatus.lastError}
                </Text>
              </View>
            </>
          ) : null}
        </FinanceSettingsGroup>

        <ConfirmCleanupModal
          visible={showForecastResetConfirmModal}
          isClearing={isResettingForecast}
          title="Forecast opnieuw opbouwen?"
          body="Dit wist de forecastdata van je huidige account en laat de forecast daarna direct opnieuw berekenen. Transacties en budget blijven staan."
          confirmLabel="Opnieuw opbouwen"
          onConfirm={handleConfirmResetForecast}
          onCancel={() => setShowForecastResetConfirmModal(false)}
        />
        <SuccessModal
          visible={showForecastResetSuccessModal}
          message={forecastResetSuccessMessage}
          onClose={() => setShowForecastResetSuccessModal(false)}
        />
        <ErrorModal
          visible={showForecastResetErrorModal}
          error={forecastResetErrorMessage}
          onClose={() => setShowForecastResetErrorModal(false)}
        />

        <FinanceSettingsGroup title="Data">
          <FinanceSettingsRow
            iconName="download"
            label="Data exporteren"
            subtitle="Download alle transacties als CSV"
            onPress={() => {}}
          />
          <View style={styles.divider} />
          <FinanceSettingsRow
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
          <FinanceSettingsRow
            iconName="delete-outline"
            label="Transacties opschonen"
            subtitle="Kies tussen de huidige maand of alles"
            onPress={handleResetPress}
            rightElement={
              isClearing ? (
                <ActivityIndicator size="small" color={FinColors.green} />
              ) : undefined
            }
          />
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Achtergrondtaken" cardStyle={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>Categorisatie</Text>
            <Text style={styles.statusPhase}>{backgroundStatus.phase}</Text>
          </View>
          <Text style={styles.statusHint}>
            Automatische categorisatie start na import. Handmatig kun je altijd
            {'"'}Alles hercategoriseren{'"'} gebruiken.
          </Text>
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
          <TouchableOpacity
            style={[
              styles.secondaryControlButton,
              !backgroundStatus.queuedCount && styles.controlButtonDisabled,
            ]}
            onPress={clearQueuedCategorizationQueue}
            disabled={!backgroundStatus.queuedCount}
          >
            <Text style={styles.secondaryControlButtonText}>
              Wachtrij leegmaken
            </Text>
          </TouchableOpacity>
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
        </FinanceSettingsGroup>

        <FinanceSettingsGroup title="Over Budio">
          <FinanceSettingsRow iconName="info-outline" label="Versie" value="0.1" />
          <View style={styles.divider} />
          <FinanceSettingsRow
            iconName="support-agent"
            label="Hulp en support"
            onPress={() => {}}
          />
        </FinanceSettingsGroup>

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
      </View>

      <FinanceQuickMenu
        activeKey={null}
        onSelect={(key: FinanceQuickMenuKey) => {
          if (key === "index") router.push("/");
          if (key === "transactions") router.push("/transactions");
          if (key === "insights") router.push("/insights");
          if (key === "budget") router.push("/budget");
        }}
      />

      <CleanupScopeSheet
        visible={showCleanupScopeSheet}
        currentMonthLabel={cleanupScopeInfo.monthLabel || "de huidige maand"}
        onSelect={handleSelectCleanupScope}
        onCancel={() => setShowCleanupScopeSheet(false)}
      />
      <ConfirmCleanupModal
        visible={showConfirmModal}
        isClearing={isClearing}
        title={cleanupScopeInfo.confirmationTitle}
        body={cleanupScopeInfo.confirmationBody}
        confirmLabel="Wissen"
        onConfirm={handleConfirmReset}
        onCancel={() => setShowConfirmModal(false)}
      />
      <SuccessModal
        visible={showSuccessModal}
        message={successMessage}
        onClose={() => setShowSuccessModal(false)}
      />
      <ErrorModal
        visible={showErrorModal}
        error={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </FinanceUtilityShell>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FinColors.bgBase, overflow: "hidden" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: FinColors.topBarBg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.10)",
  },
  topBarInner: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -1,
  },
  scroll: { paddingHorizontal: 24, paddingBottom: 176, gap: 10 },
  heroShell: {
    backgroundColor: FinColors.bgElevated,
    marginHorizontal: -24,
  },
  heroTitle: {
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 760,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
  },

  // Profile
  profileCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 20,
    marginBottom: 4,
    gap: 14,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(242,201,76,0.16)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 17,
    fontWeight: "700",
    color: FinColors.textSecondary,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 19,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  profileEmail: { fontSize: 13, color: FinColors.textMuted, marginTop: 2 },
  profileMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  profileStatusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: FinColors.warningBg,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  profileStatusPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.warningText,
  },
  profileMetaText: {
    fontSize: 11,
    color: FinColors.textSecondary,
    flexShrink: 1,
  },

  // Section
  sectionHeader: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 2,
    paddingHorizontal: 4,
    paddingTop: 18,
    paddingBottom: 10,
  },

  // Card
  card: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 22,
    overflow: "hidden",
  },

  // Row
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "700", color: FinColors.textPrimary },
  rowSub: { fontSize: 12, color: FinColors.textMuted, marginTop: 4 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowValue: { fontSize: 14, color: FinColors.textSecondary, fontWeight: "500" },
  cleanupChoiceCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  cleanupHint: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: FinColors.borderSubtle,
    marginLeft: 20,
  },
  inlineNote: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  inlineNoteError: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.red,
  },

  statusCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 22,
    padding: 18,
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
  statusHint: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
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
    marginTop: 10,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: FinColors.yellowSoft,
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
  },
  controlButtonDisabled: {
    opacity: 0.45,
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: FinColors.textPrimary,
  },
  secondaryControlButton: {
    marginTop: 10,
    paddingVertical: 11,
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  secondaryControlButtonText: {
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
    marginTop: 20,
    backgroundColor: FinColors.bgCard,
    borderRadius: 999,
    paddingVertical: 15,
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
    borderRadius: 24,
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
