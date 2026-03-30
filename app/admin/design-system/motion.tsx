import {
  DesignSystemBlockGrid,
  DesignSystemPageHero,
  DesignSystemStatsRow,
  DesignSystemSubtlePanel,
} from "@/components/admin/design-system-page-kit";
import { designSystemSharedStyles } from "@/components/admin/design-system-hub";
import { SplashLoader } from "@/components/motions/SplashLoader";
import { FinanceAssistantMotionButton } from "@/components/motions/finance-assistant-motion-button";
import { FinanceAssistantMotionGlyph } from "@/components/motions/finance-assistant-motion-glyph";
import { FinanceLiveStatusDotMotion } from "@/components/motions/finance-live-status-dot-motion";
import { FinanceDetailCard } from "@/components/ui/finance-detail-card";
import { FinancePrimaryCtaButton } from "@/components/ui/finance-primary-cta-button";
import { FinanceSettingsGroup } from "@/components/ui/finance-settings-group";
import { FinanceStatusChip } from "@/components/ui/finance-status-chip";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
import {
  designSystemHubMotionFamilies,
  designSystemHubSections,
} from "@/services/design-system-hub";
import { type Href, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

function resolveFamilyStatusTone(status: "canoniek" | "in gebruik" | "legacy") {
  if (status === "canoniek") return "good" as const;
  if (status === "legacy") return "critical" as const;
  return "watch" as const;
}

async function copyToClipboard(value: string) {
  const safeValue = String(value || "").trim();
  if (!safeValue) return false;
  const webNavigator = (globalThis as {
    navigator?: {
      clipboard?: {
        writeText?: (text: string) => Promise<void>;
      };
    };
  }).navigator;
  if (Platform.OS === "web" && webNavigator?.clipboard?.writeText) {
    await webNavigator.clipboard.writeText(safeValue);
    return true;
  }
  return false;
}

function PreviewFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.previewFrame}>{children}</View>;
}

function MotionPreviewItem({
  title,
  copyValue,
  note,
  copied,
  onCopy,
  children,
}: {
  title: string;
  copyValue: string;
  note: string;
  copied: boolean;
  onCopy: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.previewItem}>
      <View style={styles.previewHeader}>
        <View style={styles.previewTitleStack}>
          <FinanceText variant="body-sm" tone="primary" weight="bold">
            {title}
          </FinanceText>
          <FinanceText variant="caption" tone="muted">
            {note}
          </FinanceText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onCopy(copyValue)}
          style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}
        >
          <FinanceText variant="caption" tone={copied ? "primary" : "secondary"} weight="bold">
            {copied ? "Gekopieerd" : "Kopieer naam"}
          </FinanceText>
        </Pressable>
      </View>
      <PreviewFrame>{children}</PreviewFrame>
    </View>
  );
}

function FamilyCard({
  title,
  status,
  usedIn,
  source,
  note,
  items,
}: {
  title: string;
  status: "canoniek" | "in gebruik" | "legacy";
  usedIn: string;
  source: string;
  note: string;
  items: string[];
}) {
  return (
    <FinanceDetailCard
      title={title}
      subtitle={usedIn}
      rightSlot={<FinanceStatusChip label={status} tone={resolveFamilyStatusTone(status)} />}
    >
      <View style={styles.familyStack}>
        <FinanceText variant="caption" tone="muted">
          {source}
        </FinanceText>
        <FinanceText variant="body-sm" tone="secondary">
          {note}
        </FinanceText>
        <View style={styles.itemWrap}>
          {items.map((item) => (
            <View key={`${title}-${item}`} style={styles.itemPill}>
              <FinanceText variant="caption" tone="secondary" weight="bold">
                {item}
              </FinanceText>
            </View>
          ))}
        </View>
      </View>
    </FinanceDetailCard>
  );
}

export default function DesignSystemMotionScreen() {
  const router = useRouter();
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = React.useCallback((value: string) => {
    void copyToClipboard(value).then((ok) => {
      if (!ok) return;
      setCopiedKey(value);
      setTimeout(() => {
        setCopiedKey((current) => (current === value ? null : current));
      }, 1200);
    });
  }, []);

  return (
    <View style={designSystemSharedStyles.pageStack}>
      <DesignSystemPageHero
        eyebrow="Design system motion"
        title="Motioncomponenten en hooks"
        subtitle="Zelfde principe als componenten: echte code uit de repo, met duidelijke gebruiksgrenzen."
        actions={[
          {
            label: "Componenten",
            onPress: () => router.push("/admin/design-system/components" as Href),
          },
          {
            label: "Patronen",
            onPress: () => router.push("/admin/design-system/patterns" as Href),
            variant: "secondary",
          },
        ]}
        statuses={[
          { label: "Admin-only", tone: "critical" },
          { label: "Echte motion", tone: "good" },
          { label: "Subtiel", tone: "watch" },
        ]}
      />

      <DesignSystemStatsRow
        items={[
          { label: "Motion families", value: `${designSystemHubMotionFamilies.length}` },
          { label: "Hub-secties", value: `${designSystemHubSections.length}` },
          { label: "Visuele componenten", value: "3" },
          { label: "Hooks", value: "3", tone: "muted" },
        ]}
      />

      <DesignSystemBlockGrid>
        <FinanceDetailCard
          title="Motion governance"
          subtitle="Wanneer wel en niet"
        >
          <DesignSystemSubtlePanel>
            <FinanceText variant="body-sm" tone="secondary">
              Gebruik motion om status en aandacht te ondersteunen, niet om inhoud te overschreeuwen.
            </FinanceText>
            <FinanceText variant="body-sm" tone="secondary">
              Respecteer altijd reduce-motion. Bewegende elementen blijven functioneel en subtiel.
            </FinanceText>
          </DesignSystemSubtlePanel>
        </FinanceDetailCard>

        <FinanceDetailCard title="Snelle links" subtitle="Door naar andere DS-secties" tone="subtle">
          <View style={styles.quickRow}>
            {designSystemHubSections
              .filter((section) => section.id !== "motion")
              .slice(0, 4)
              .map((section) => (
                <FinancePrimaryCtaButton
                  key={section.id}
                  label={section.label}
                  onPress={() => router.push(section.href as Href)}
                />
              ))}
          </View>
        </FinanceDetailCard>
      </DesignSystemBlockGrid>

      <FinanceSettingsGroup title="Live motion previews">
        <View style={styles.previewStack}>
          <MotionPreviewItem
            title="FinanceAssistantMotionButton"
            copyValue="FinanceAssistantMotionButton"
            note="Canonieke assistant trigger met ingebouwde motion-glyph."
            copied={copiedKey === "FinanceAssistantMotionButton"}
            onCopy={handleCopy}
          >
            <View style={styles.centeredRow}>
              <FinanceAssistantMotionButton
                accessibilityLabel="Assistant demo knop"
                onPress={() => {}}
              />
              <FinanceAssistantMotionButton
                accessibilityLabel="Assistant demo knop disabled"
                onPress={() => {}}
                disabled
              />
            </View>
          </MotionPreviewItem>

          <MotionPreviewItem
            title="FinanceAssistantMotionGlyph"
            copyValue="FinanceAssistantMotionGlyph"
            note="Losse glyph voor headers, avatars of inline assistant-context."
            copied={copiedKey === "FinanceAssistantMotionGlyph"}
            onCopy={handleCopy}
          >
            <View style={styles.centeredRow}>
              <FinanceAssistantMotionGlyph size={22} />
              <FinanceAssistantMotionGlyph size={18} disabled />
            </View>
          </MotionPreviewItem>

          <MotionPreviewItem
            title="FinanceLiveStatusDotMotion"
            copyValue="FinanceLiveStatusDotMotion"
            note="Live-indicator motiondot voor assistant-status en realtime context."
            copied={copiedKey === "FinanceLiveStatusDotMotion"}
            onCopy={handleCopy}
          >
            <View style={styles.centeredRow}>
              <FinanceLiveStatusDotMotion />
              <FinanceLiveStatusDotMotion size={10} />
              <FinanceLiveStatusDotMotion disabled />
            </View>
          </MotionPreviewItem>

          <MotionPreviewItem
            title="SplashLoader"
            copyValue="SplashLoader"
            note="Image-based splash met configureerbare copy, rustige motion en reduce-motion ondersteuning."
            copied={copiedKey === "SplashLoader"}
            onCopy={handleCopy}
          >
            <View style={styles.loaderFrame}>
              <SplashLoader
                imageSource={require("../../../assets/images/budio-splash-motion.png")}
                eyebrow="Budio"
                title="Je cockpit komt zo online"
                subtitle="We laden veilige ruimte, wat nu vrij is en de volgende stap."
                label="Synchroniseren"
                size={78}
                background={false}
              />
            </View>
          </MotionPreviewItem>
        </View>
      </FinanceSettingsGroup>

      <FinanceSettingsGroup title="Motion hooks">
        <View style={styles.previewStack}>
          <MotionPreviewItem
            title="useFinanceAssistantMotion"
            copyValue="useFinanceAssistantMotion"
            note="Hook voor lift/tilt/scale ritme in assistant-glyphs."
            copied={copiedKey === "useFinanceAssistantMotion"}
            onCopy={handleCopy}
          >
            <View style={styles.codeStack}>
              <FinanceText variant="caption" tone="secondary">components/motions/use-finance-assistant-motion.ts</FinanceText>
              <FinanceText variant="caption" tone="muted">props: disabled?, durationMs?</FinanceText>
            </View>
          </MotionPreviewItem>

          <MotionPreviewItem
            title="useSplashLoaderAnimation"
            copyValue="useSplashLoaderAnimation"
            note="Levert fase-, ring-, pulse- en glow-waarden voor loaderanimaties."
            copied={copiedKey === "useSplashLoaderAnimation"}
            onCopy={handleCopy}
          >
            <View style={styles.codeStack}>
              <FinanceText variant="caption" tone="secondary">components/motions/useSplashLoaderAnimation.ts</FinanceText>
              <FinanceText variant="caption" tone="muted">params: size, speed, intensity, reduceMotion</FinanceText>
            </View>
          </MotionPreviewItem>

          <MotionPreviewItem
            title="useBudioAssistantEmptyStateAnimation"
            copyValue="useBudioAssistantEmptyStateAnimation"
            note="Ambient motion voor assistant-empty-states en onboardingcontext."
            copied={copiedKey === "useBudioAssistantEmptyStateAnimation"}
            onCopy={handleCopy}
          >
            <View style={styles.codeStack}>
              <FinanceText variant="caption" tone="secondary">components/motions/useBudioAssistantEmptyStateAnimation.ts</FinanceText>
              <FinanceText variant="caption" tone="muted">params: intensity?, reduceMotion?</FinanceText>
            </View>
          </MotionPreviewItem>
        </View>
      </FinanceSettingsGroup>

      <FinanceSettingsGroup title="Families">
        <View style={styles.previewStack}>
          {designSystemHubMotionFamilies.map((family) => (
            <FamilyCard
              key={family.title}
              title={family.title}
              status={family.status}
              usedIn={family.usedIn}
              source={family.source}
              note={family.note}
              items={family.items}
            />
          ))}
        </View>
      </FinanceSettingsGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  previewStack: {
    gap: FinSpacing["l-plus"],
  },
  previewItem: {
    gap: FinSpacing.s,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.m,
  },
  previewTitleStack: {
    flex: 1,
    gap: FinSpacing.x1,
  },
  copyButton: {
    borderRadius: FinRadius.pill,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
  },
  copyButtonPressed: {
    opacity: 0.85,
  },
  previewFrame: {
    borderRadius: FinRadius.xl,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: FinSpacing["l-plus"],
    paddingVertical: FinSpacing["l-plus"],
    minHeight: 128,
    justifyContent: "center",
    gap: FinSpacing.m,
  },
  centeredRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: FinSpacing.l,
  },
  loaderFrame: {
    height: 190,
  },
  codeStack: {
    gap: FinSpacing.x1,
  },
  familyStack: {
    gap: FinSpacing.x2,
  },
  itemWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.x2,
  },
  itemPill: {
    borderRadius: FinRadius.pill,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgInput,
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
  },
  quickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.s,
  },
});
