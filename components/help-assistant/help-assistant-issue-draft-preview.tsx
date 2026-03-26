import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import type { HelpAssistantIssueFlowDraft } from "@/services/help-assistant-issue-flow";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type HelpAssistantIssueDraftPreviewProps = {
  draft: HelpAssistantIssueFlowDraft;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
  onCreateIssue: () => void;
  onEditFirst: () => void;
  onCancel: () => void;
};

export function HelpAssistantIssueDraftPreviewCard({
  draft,
  isSubmitting = false,
  isSubmitted = false,
  onCreateIssue,
  onEditFirst,
  onCancel,
}: HelpAssistantIssueDraftPreviewProps) {
  const statusLabel =
    draft.status === "ready_to_review"
      ? "Concept – nog niet verstuurd"
      : draft.status === "submitting"
        ? "Bezig met versturen"
        : draft.status === "submitted"
          ? "Verstuurd naar Budio"
          : "Concept";
  const title =
    draft.type === "bug"
      ? `Probleem voor ${draft.featureArea}`
      : draft.type === "feedback"
        ? `Feedback voor ${draft.featureArea}`
        : `Idee voor ${draft.featureArea}`;
  const prompt =
    draft.status === "submitted"
      ? "Dankjewel, dit staat nu klaar voor Budio."
      : draft.status === "submitting"
        ? "Even geduld, ik verstuur dit naar Budio."
        : draft.status === "ready_to_review"
          ? "Als dit klopt, kun je het zo versturen."
          : "We maken hier een melding van en kunnen dit nog verfijnen in de chat.";

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={styles.avatar}>
          <AppIcon
            name="smart-toy"
            size={13}
            color={FinColors.textPrimary}
            variant="outlined"
          />
        </View>
        <View style={styles.labelStack}>
          <Text style={styles.label}>Melding in aanmaak</Text>
          <Text style={styles.labelSubtle}>
            {draft.status === "submitting"
              ? "Bezig met versturen"
              : draft.status === "submitted"
                ? "Verstuurd"
                : "Concept"}
          </Text>
        </View>
      </View>

      <View style={styles.bubble}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.status}>{statusLabel}</Text>
        </View>
        <Text style={styles.summary}>{draft.summary}</Text>
        <Text style={styles.prompt}>{prompt}</Text>
        {!isSubmitted && draft.status !== "submitted" ? (
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                isSubmitting && styles.disabled,
              ]}
              onPress={onCreateIssue}
              disabled={isSubmitting}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? "Bezig..." : "Versturen"}
              </Text>
            </Pressable>

            <View style={styles.secondaryRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}
                onPress={onEditFirst}
                disabled={isSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Eerst aanpassen</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.ghostButton,
                  pressed && styles.pressed,
                  isSubmitting && styles.disabled,
                ]}
                onPress={onCancel}
                disabled={isSubmitting}
              >
                <Text style={styles.ghostButtonText}>Annuleren</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 7,
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: "100%",
    paddingHorizontal: 2,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
  },
  labelStack: {
    gap: 1,
  },
  label: {
    fontSize: 9.5,
    lineHeight: 12,
    fontWeight: "700",
    letterSpacing: 0.65,
    color: FinColors.textPrimary,
    textTransform: "uppercase",
  },
  labelSubtle: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "400",
    color: FinColors.textMuted,
  },
  bubble: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 7,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  titleRow: {
    gap: 4,
  },
  title: {
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "600",
    color: FinColors.textPrimary,
  },
  status: {
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: "400",
    color: FinColors.textMuted,
  },
  summary: {
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "400",
    color: FinColors.textPrimary,
  },
  prompt: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "400",
    color: FinColors.textMuted,
  },
  actions: {
    gap: 6,
    marginTop: 2,
  },
  primaryButton: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: FinColors.yellow,
    paddingHorizontal: 13,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: FinColors.textPrimary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  secondaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  secondaryButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "#f7f7f8",
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: FinColors.textPrimary,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "400",
  },
  ghostButton: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostButtonText: {
    color: FinColors.textMuted,
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "400",
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
});
