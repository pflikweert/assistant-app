import { AppIcon } from "@/components/ui/app-icon";
import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinanceDetailShell } from "@/components/ui/finance-detail-shell";
import { FinanceHelpAssistantTrigger } from "@/components/ui/finance-help-assistant-trigger";
import { FinanceStatusChip } from "@/components/ui/finance-status-chip";
import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { IMPORT_FLOW_STEPS } from "@/components/import/import-flow-steps";
import {
  beginImportRun,
  resetImportRun,
  useImportFlowState,
} from "@/services/import/import-flow-state";
import { executeImportDraft } from "@/services/import/import-runner";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";

type StageTone = "done" | "current" | "pending";

function getStageTone(
  status: "idle" | "preparing" | "writing" | "completed" | "error",
  stage: "preparing" | "writing",
): StageTone {
  if (stage === "preparing") {
    if (status === "preparing") return "current";
    if (status === "writing" || status === "completed") return "done";
    return "pending";
  }

  if (status === "writing") return "current";
  if (status === "completed") return "done";
  return "pending";
}

function StageRow({
  label,
  tone,
  detail,
  accent,
}: {
  label: string;
  tone: StageTone;
  detail: string;
  accent?: string | null;
}) {
  const chipTone = tone === "done" ? "good" : tone === "current" ? "watch" : "neutral";
  const chipLabel = tone === "done" ? "Klaar" : tone === "current" ? "Lopend" : "Wachten";

  return (
    <View style={styles.stageRow}>
      <View
        style={[
          styles.stageDot,
          tone === "done" && styles.stageDotDone,
          tone === "current" && styles.stageDotCurrent,
        ]}
      >
        {tone === "done" ? (
          <AppIcon name="check" size={13} color={FinColors.textPrimary} variant="outlined" />
        ) : tone === "current" ? (
          <ActivityIndicator size="small" color={FinColors.warningText} />
        ) : null}
      </View>
      <View style={styles.stageTextWrap}>
        <View style={styles.stageLabelRow}>
          <Text style={styles.stageLabel}>{label}</Text>
          <FinanceStatusChip label={chipLabel} tone={chipTone} />
        </View>
        <Text style={styles.stageDetail}>{detail}</Text>
        {accent ? <Text style={styles.stageAccent}>{accent}</Text> : null}
      </View>
    </View>
  );
}

function buildHeroCopy(status: "idle" | "preparing" | "writing" | "completed" | "error") {
  if (status === "preparing") {
    return {
      title: "Controleren",
      text: "Budio controleert of elke bronrekening goed gekoppeld is voordat het inlezen start.",
    };
  }
  if (status === "writing") {
    return {
      title: "Opslaan",
      text: "Budio schrijft de transacties nu veilig weg. Categorisatie start daarna op de achtergrond.",
    };
  }
  if (status === "completed") {
    return {
      title: "Klaar",
      text: "De transacties zijn ingelezen. We openen nu de afronding.",
    };
  }
  if (status === "error") {
    return {
      title: "Transacties inlezen",
      text: "Het inlezen is gestopt. Je kunt dit direct opnieuw proberen.",
    };
  }
  return {
    title: "Transacties inlezen",
    text: "Budio start zo met controleren en opslaan.",
  };
}

export default function ImportControlScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { draft, run } = useImportFlowState();
  const isBusy = run.status === "preparing" || run.status === "writing";

  React.useEffect(() => {
    if (!draft || run.status !== "idle" || run.result) return;
    if (!beginImportRun()) return;

    void executeImportDraft(draft).catch(() => {
      // Error state is already written into the import store.
    });
  }, [draft, run.result, run.status]);

  React.useEffect(() => {
    if (run.status !== "completed" || !run.result) return;
    router.replace("/import-afronden");
  }, [router, run.result, run.status]);

  const beforeRemove = React.useCallback(
    (event: any) => {
      if (!isBusy) return;
      event.preventDefault();
      Alert.alert(
        "Even wachten",
        "Budio leest de transacties nog in. Wacht heel even tot de afronding klaarstaat.",
      );
    },
    [isBusy],
  );

  React.useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", beforeRemove);
    return unsub;
  }, [beforeRemove, navigation]);

  const heroCopy = buildHeroCopy(run.status);
  const progress = run.progress;
  const controlDetail =
    run.status === "preparing"
      ? progress?.detail || "Koppelingen worden gecontroleerd"
      : run.status === "idle"
        ? "We starten zo met de controle"
        : "Koppelingen zijn in orde";

  const writingDetail =
    run.status === "writing" && progress?.batchNumber && progress?.batchTotal
      ? `Batch ${progress.batchNumber} van ${progress.batchTotal}`
      : run.status === "completed"
        ? "Opslaan afgerond"
        : run.status === "error"
          ? "Opslaan is onderbroken"
          : "Wachten op opslaan";

  const savedCount =
    typeof progress?.savedCount === "number"
      ? progress.savedCount
      : run.result?.importedTransactions;
  const skippedCount =
    typeof progress?.skippedCount === "number"
      ? progress.skippedCount
      : run.result?.skippedTransactions;
  const totalCount =
    typeof progress?.totalCount === "number"
      ? progress.totalCount
      : draft?.summary.totalTransactions;

  const writingStats = [
    typeof savedCount === "number" && typeof totalCount === "number"
      ? `${savedCount} van ${totalCount} opgeslagen`
      : null,
    typeof skippedCount === "number" && skippedCount > 0
      ? `${skippedCount} overgeslagen`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const writingAccent = [
    writingStats || null,
    progress?.linkedAccountName || null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!draft) {
    return (
      <FinanceDetailShell
        title="Transacties inlezen"
        onBack={() => router.back()}
        rightSlot={
          <FinanceHelpAssistantTrigger
            screenId="import"
            screenContext={{
              kind: "import",
              stage: run.status,
              progressMessage: run.progress?.message || undefined,
            }}
          />
        }
        contentContainerStyle={styles.content}
        contentMaxStyle={styles.contentMax}
      >
        <FinanceDetailCard style={styles.emptyCard}>
          <AppIcon name="folder-open" size={34} color={FinColors.warningText} variant="outlined" />
          <Text style={styles.emptyTitle}>Geen import gevonden</Text>
          <Text style={styles.emptyText}>
            Ga terug naar importeren en kies opnieuw een bestand.
          </Text>
          <FinanceButton
            label="Terug naar import"
            variant="secondary"
            onPress={() => router.replace("/csv-import")}
          />
        </FinanceDetailCard>
      </FinanceDetailShell>
    );
  }

  return (
    <FinanceDetailShell
      title="Transacties inlezen"
      onBack={() => router.back()}
      rightSlot={
        <FinanceHelpAssistantTrigger
          screenId="import"
          selectedPeriod={{ label: draft.summary.periodLabel }}
          screenContext={{
            kind: "import",
            sourceLabel: draft.summary.sourceLabel,
            totalTransactions: draft.summary.totalTransactions,
            periodLabel: draft.summary.periodLabel,
            stage: run.status,
            progressMessage: run.progress?.message || undefined,
          }}
        />
      }
      contentContainerStyle={styles.content}
      contentMaxStyle={styles.contentMax}
    >
          <FinanceStepIndicator
            steps={IMPORT_FLOW_STEPS}
            currentStepKey="import-transactions"
            completedStepKeys={["choose-file", "link-accounts"]}
          />

          <View style={styles.heroCard}>
            <Text style={styles.heroTitle}>{heroCopy.title}</Text>
            <Text style={styles.heroText}>{heroCopy.text}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Bestandscontext</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Type</Text>
                <Text style={styles.summaryValue}>{draft.summary.sourceLabel}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Transacties</Text>
                <Text style={styles.summaryValue}>{draft.summary.totalTransactions}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Rekeningen</Text>
                <Text style={styles.summaryValue}>{draft.summary.foundAccounts}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Periode</Text>
                <Text style={styles.summaryValue}>{draft.summary.periodLabel}</Text>
              </View>
            </View>
          </View>

          {run.status === "error" && run.errorMessage ? (
            <FinanceDetailCard style={styles.errorCard}>
              <Text style={styles.errorTitle}>Transacties inlezen mislukt</Text>
              <Text style={styles.errorText}>{run.errorMessage}</Text>
              <View style={styles.errorActions}>
                <FinanceButton
                  label="Opnieuw proberen"
                  onPress={() => {
                    resetImportRun();
                  }}
                  leftIcon={
                    <AppIcon
                      name="refresh"
                      size={16}
                      color={FinColors.textPrimary}
                      variant="outlined"
                    />
                  }
                />
                <FinanceButton
                  label="Terug naar koppelen"
                  variant="secondary"
                  onPress={() => router.back()}
                />
              </View>
            </FinanceDetailCard>
          ) : (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <View style={styles.progressHeadline}>
                  <Text style={styles.progressTitle}>
                    {progress?.message || "We starten zo meteen"}
                  </Text>
                  <Text style={styles.progressText}>
                    {progress?.detail || "Budio werkt dit bestand stap voor stap af."}
                  </Text>
                </View>
                <View style={styles.progressBadge}>
                  {isBusy ? (
                    <ActivityIndicator color={FinColors.warningText} />
                  ) : (
                    <AppIcon name="check" size={18} color={FinColors.warningText} variant="outlined" />
                  )}
                </View>
              </View>

              <View style={styles.stageList}>
                <StageRow
                  label="Controleren"
                  tone={getStageTone(run.status, "preparing")}
                  detail={controlDetail}
                />
                <StageRow
                  label="Opslaan"
                  tone={getStageTone(run.status, "writing")}
                  detail={writingDetail}
                  accent={writingAccent || null}
                />
              </View>

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Budio werkt batch voor batch</Text>
                <Text style={styles.noteText}>
                  Je ziet hier steeds welke batch wordt opgeslagen en naar welke rekening de transacties gaan.
                </Text>
              </View>
            </View>
          )}
    </FinanceDetailShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 28,
  },
  contentMax: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 32,
    gap: 14,
  },
  heroCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 28,
    padding: 20,
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.5,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
  summaryCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryItem: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 148,
    backgroundColor: FinColors.bgElevated,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  progressCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressHeadline: {
    flex: 1,
    gap: 2,
  },
  progressTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  progressText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  progressBadge: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
  },
  stageList: {
    gap: 10,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: FinColors.bgElevated,
  },
  stageDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgInput,
    flexShrink: 0,
  },
  stageDotDone: {
    backgroundColor: FinColors.greenBg,
  },
  stageDotCurrent: {
    backgroundColor: FinColors.warningBg,
  },
  stageTextWrap: {
    flex: 1,
    gap: 2,
  },
  stageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  stageLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: FinColors.textPrimary,
  },
  stageDetail: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textSecondary,
  },
  stageAccent: {
    fontSize: 12,
    lineHeight: 17,
    color: FinColors.textPrimary,
    fontWeight: "700",
  },
  noteCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  noteTitle: {
    fontSize: 14,
    lineHeight: 19,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  noteText: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  errorCard: {
    backgroundColor: FinColors.bgCard,
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  errorTitle: {
    fontSize: 16,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 13,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  errorActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  emptyCard: {
    borderRadius: 28,
    padding: 20,
    gap: 10,
    alignItems: "flex-start",
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    color: FinColors.textSecondary,
  },
});
