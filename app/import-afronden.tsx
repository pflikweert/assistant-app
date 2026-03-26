import { AppIcon } from "@/components/ui/app-icon";
import { FinanceDetailTopBar } from "@/components/ui/finance-detail-top-bar";
import { FinanceScreenBackdrop } from "@/components/ui/finance-screen-backdrop";
import { FinanceStepIndicator } from "@/components/ui/finance-step-indicator";
import { FinColors, FinSurfaces } from "@/constants/theme";
import { IMPORT_FLOW_STEPS } from "@/components/import/import-flow-steps";
import {
  clearCurrentImportDraft,
  clearCurrentImportRunResult,
  useImportFlowState,
} from "@/services/import/import-flow-state";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function ImportAfrondenScreen() {
  const router = useRouter();
  const { draft, run } = useImportFlowState();
  const result = run.result;

  React.useEffect(() => {
    if (run.status === "completed" && result) return;
    if (draft) {
      router.replace("/import-control");
      return;
    }
    router.replace("/csv-import");
  }, [draft, result, router, run.status]);

  if (!result) {
    return null;
  }

  const goToTransactions = () => {
    router.replace("/transactions");
  };

  const goToNewImport = () => {
    clearCurrentImportDraft();
    clearCurrentImportRunResult();
    router.replace("/csv-import");
  };

  const hasNewTransactions = result.importedTransactions > 0;
  const topBarTitle = "Afronden";
  const heroTitle = hasNewTransactions ? "De transacties zijn ingelezen" : "Het bestand is verwerkt";
  const heroText = hasNewTransactions
    ? "Je kunt nu je transacties bekijken of nog een bestand inlezen."
    : "Alles uit dit bestand stond al in Budio. Je kunt nu je transacties bekijken of nog een bestand inlezen.";
  const noteTitle = result.categorizationQueued
    ? "Categorisatie is gestart"
    : "Categorisatie is niet nodig";
  const noteText = result.categorizationQueued
    ? "Nieuwe transacties worden op de achtergrond verder bijgewerkt."
    : "Alles uit dit bestand was al aanwezig of is overgeslagen.";
  const noteHint = result.categorizationQueued
    ? "Je hoeft niet te wachten. Je kunt nu direct verder."
    : "Je kunt nu direct verder.";

  return (
    <View style={styles.root}>
      <FinanceScreenBackdrop tone="warm" />
      <FinanceDetailTopBar title={topBarTitle} onBack={goToNewImport} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentMax}>
          <FinanceStepIndicator
            steps={IMPORT_FLOW_STEPS}
            currentStepKey="finish"
            completedStepKeys={[
              "choose-file",
              "link-accounts",
              "import-transactions",
            ]}
          />

          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <AppIcon name="check" size={30} color={FinColors.textPrimary} variant="outlined" />
            </View>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroText}>{heroText}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.sectionTitle}>Samenvatting</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Ingelezen</Text>
                <Text style={styles.summaryValue}>{result.importedTransactions}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Overgeslagen</Text>
                <Text style={styles.summaryValue}>{result.skippedTransactions}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Rekeningen</Text>
                <Text style={styles.summaryValue}>{result.linkedAccounts}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Periode</Text>
                <Text style={styles.summaryValue}>{result.periodLabel}</Text>
              </View>
            </View>
          </View>

          <View style={styles.noteCard}>
            <View style={styles.noteHeader}>
              <View style={styles.noteTitleWrap}>
                <Text style={styles.noteTitle}>{noteTitle}</Text>
                <Text style={styles.noteText}>{noteText}</Text>
              </View>
              <View style={styles.noteStatusBadge}>
                {result.categorizationQueued ? (
                  <ActivityIndicator size="small" color={FinColors.warningText} />
                ) : (
                  <AppIcon name="check" size={16} color={FinColors.warningText} variant="outlined" />
                )}
              </View>
            </View>
            <Text style={styles.noteHint}>{noteHint}</Text>
          </View>

          <View style={styles.actionsCard}>
            <Pressable
              accessibilityRole="button"
              onPress={goToTransactions}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <AppIcon name="receipt-long" size={18} color={FinColors.bgBase} variant="outlined" />
              <Text style={styles.primaryButtonText}>Ga naar transacties</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={goToNewImport}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            >
              <AppIcon name="upload-file" size={18} color={FinColors.textPrimary} variant="outlined" />
              <Text style={styles.secondaryButtonText}>Nog een bestand inlezen</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: FinColors.bgBase,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
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
    alignItems: "flex-start",
  },
  heroIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#fff0c2",
    alignItems: "center",
    justifyContent: "center",
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
  noteCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  noteTitleWrap: {
    flex: 1,
    gap: 8,
  },
  noteStatusBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: FinColors.bgElevated,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  noteTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: FinColors.textSecondary,
  },
  noteHint: {
    fontSize: 12,
    lineHeight: 18,
    color: FinColors.textMuted,
    fontWeight: "600",
  },
  actionsCard: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 24,
    padding: 16,
    gap: 10,
  },
  primaryButton: {
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgElevated,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.86,
  },
});
