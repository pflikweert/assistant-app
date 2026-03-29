import { FinancePressableSurface } from "@/components/ui/finance-pressable-surface";
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
import { designSystemHubSections, type DesignSystemHubSectionId } from "@/services/design-system-hub";
import { usePathname, useRouter, type Href } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

function isActiveSection(pathname: string, sectionId: DesignSystemHubSectionId) {
  if (sectionId === "overview") return pathname === "/admin/design-system";
  return pathname === `/admin/design-system/${sectionId}`;
}

export function DesignSystemNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.navShell}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow}>
        {designSystemHubSections.map((section) => {
          const active = isActiveSection(pathname, section.id);
          return (
            <FinancePressableSurface
              key={section.id}
              onPress={() => router.push(section.href as Href)}
              accessibilityRole="button"
              style={[styles.navChip, active && styles.navChipActive]}
              pressedStyle={styles.navChipPressed}
            >
              <Text style={[styles.navChipText, active && styles.navChipTextActive]}>
                {section.label}
              </Text>
            </FinancePressableSurface>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function DesignSystemSurface({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.surface}>{children}</View>;
}

export const designSystemSharedStyles = StyleSheet.create({
  pageStack: {
    gap: FinSpacing["l-plus"],
    paddingBottom: FinSpacing["3xl"],
  },
});

const styles = StyleSheet.create({
  navShell: {
    paddingTop: FinSpacing.x2,
    paddingBottom: FinSpacing.x2,
    backgroundColor: FinColors.bgBase,
    position: "relative",
    zIndex: 5,
  },
  navRow: {
    gap: FinSpacing.x2,
    paddingVertical: FinSpacing.x2,
  },
  navChip: {
    borderRadius: FinRadius.pill,
    paddingHorizontal: FinSpacing.m,
    paddingVertical: FinSpacing.xs,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  navChipActive: {
    backgroundColor: FinColors.yellowSoft,
    borderColor: FinColors.warningBorder,
  },
  navChipPressed: {
    opacity: 0.85,
  },
  navChipText: {
    color: FinColors.textSecondary,
    fontSize: 13,
    fontWeight: "800",
  },
  navChipTextActive: {
    color: FinColors.warningText,
  },
  surface: {
    gap: FinSpacing.m,
  },
});
