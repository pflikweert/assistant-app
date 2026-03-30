import { FinanceAssistantMotionGlyph } from "@/components/motions/finance-assistant-motion-glyph";
import { FinanceHelpAssistantTrigger } from "@/components/ui/finance-help-assistant-trigger";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import { useRouter } from "expo-router";
import type {
  HelpAssistantPeriodContext,
  HelpAssistantScreenId,
  HelpAssistantScreenContextData,
} from "@/services/help-assistant-context";
import React from "react";
import { Pressable, StyleSheet, Text, type PressableStateCallbackType, View } from "react-native";

type DashboardAssistantCalloutProps = {
  screenId?: HelpAssistantScreenId;
  selectedPeriod?: HelpAssistantPeriodContext | null;
  screenContext?: HelpAssistantScreenContextData | null;
  eyebrow?: string;
  title?: string;
  copy?: string;
  accessibilityHint?: string;
  href?: string;
};

function buildCardStyle({ pressed }: PressableStateCallbackType) {
  return [styles.card, pressed && styles.cardPressed];
}

export function DashboardAssistantCallout({
  screenId = "dashboard",
  selectedPeriod,
  screenContext,
  eyebrow = "BUDIO AI",
  title = "Laat Budio even met je meekijken",
  copy = "Vraag rustig wat er deze maand nog kan, waar je tempo oploopt of hoe je budget ervoor staat.",
  accessibilityHint = "Stel een vraag aan Budio over je geld, budget of uitgaven.",
  href,
}: DashboardAssistantCalloutProps) {
  const router = useRouter();

  const navigate = React.useCallback(() => {
    if (href) {
      router.push(href);
    }
  }, [href, router]);

  if (href) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        onPress={navigate}
        style={buildCardStyle}
      >
        <View style={styles.iconBubble}>
          <FinanceAssistantMotionGlyph
            size={22}
            color={FinColors.warningText}
            backgroundColor={FinColors.yellow}
          />
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy} numberOfLines={2}>
            {copy}
          </Text>
        </View>

        <View style={styles.chevronWrap}>
          <AppIcon
            name="arrow-forward"
            size={18}
            color={FinColors.bgCard}
            variant="outlined"
          />
        </View>
      </Pressable>
    );
  }

  return (
    <FinanceHelpAssistantTrigger
      screenId={screenId}
      selectedPeriod={selectedPeriod}
      screenContext={screenContext}
      renderTrigger={({ onPress, context }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open hulpassistent voor ${context.screenTitle}`}
          accessibilityHint={accessibilityHint}
          onPress={onPress}
          style={buildCardStyle}
        >
          <View style={styles.iconBubble}>
            <FinanceAssistantMotionGlyph
              size={22}
              color={FinColors.warningText}
              backgroundColor={FinColors.yellow}
            />
          </View>

          <View style={styles.copyWrap}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.copy} numberOfLines={2}>
              {copy}
            </Text>
          </View>

          <View style={styles.chevronWrap}>
            <AppIcon
              name="arrow-forward"
              size={18}
              color={FinColors.bgCard}
              variant="outlined"
            />
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 26,
    backgroundColor: FinColors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginVertical: 6,
    boxShadow: "0px 10px 24px rgba(17,17,17,0.10)",
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ translateY: 1 }],
  },
  iconBubble: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: FinColors.yellow,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  copyWrap: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.2,
    fontWeight: "800",
    color: "rgba(255,255,255,0.62)",
    textTransform: "uppercase",
  },
  title: {
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.35,
    fontWeight: "800",
    color: FinColors.bgCard,
  },
  copy: {
    fontSize: 13.5,
    lineHeight: 19,
    color: "rgba(255,255,255,0.76)",
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
});
