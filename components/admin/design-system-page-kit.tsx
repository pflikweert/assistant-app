import { FinanceButton } from "@/components/ui/finance-button";
import { FinanceHeroShell } from "@/components/ui/finance-hero-shell";
import { FinanceStatusChip, type FinanceStatusTone } from "@/components/ui/finance-status-chip";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type HeroAction = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
};

type HeroStatus = {
  label: string;
  tone: FinanceStatusTone;
};

export function DesignSystemPageHero({
  eyebrow,
  title,
  subtitle,
  actions = [],
  statuses = [],
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  actions?: HeroAction[];
  statuses?: HeroStatus[];
}) {
  return (
    <FinanceHeroShell eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <View style={styles.heroRow}>
        {actions.map((action) => (
          <FinanceButton
            key={action.label}
            label={action.label}
            variant={action.variant ?? "primary"}
            onPress={action.onPress}
          />
        ))}
        {statuses.map((status) => (
          <FinanceStatusChip key={status.label} label={status.label} tone={status.tone} />
        ))}
      </View>
    </FinanceHeroShell>
  );
}

export function DesignSystemStatsRow({
  items,
}: {
  items: { label: string; value: string; tone?: "primary" | "secondary" | "muted" }[];
}) {
  return (
    <View style={styles.statRow}>
      {items.map((item) => (
        <View key={`${item.label}-${item.value}`} style={styles.statTile}>
          <FinanceText variant="caption" tone="muted" weight="bold">
            {item.label}
          </FinanceText>
          <FinanceText variant="title-sm" tone={item.tone ?? "secondary"} weight="extrabold">
            {item.value}
          </FinanceText>
        </View>
      ))}
    </View>
  );
}

export function DesignSystemBlockGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.grid}>{children}</View>;
}

export function DesignSystemSubtlePanel({
  children,
}: {
  children: React.ReactNode;
}) {
  return <View style={styles.subtlePanel}>{children}</View>;
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.s,
    alignItems: "center",
  },
  statRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.m,
  },
  statTile: {
    flexGrow: 1,
    minWidth: 170,
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgCard,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: FinSpacing["m-plus"],
    gap: FinSpacing.x1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: FinSpacing.l,
  },
  subtlePanel: {
    borderRadius: FinRadius.xl,
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    padding: FinSpacing["m-plus"],
    gap: FinSpacing.s,
  },
});
