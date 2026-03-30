import { AppIcon } from "@/components/ui/app-icon";
import { FinanceText } from "@/components/ui/finance-text";
import { BUDGET_SETUP_STRATEGY_COPY } from "@/services/budget-setup-strategy-copy";
import { FinColors, FinSpacing, FinTypography } from "@/constants/theme";
import type { BudgetSetupStrategy } from "@/services/budget-setup-proposal-schema";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type BudgetSetupStrategySelectorProps = {
  selectedStrategy: BudgetSetupStrategy;
  visibleStrategies: BudgetSetupStrategy[];
  onChange: (strategy: BudgetSetupStrategy) => void;
  eyebrowLabel?: string;
  style?: StyleProp<ViewStyle>;
};

function StrategyCard({
  strategy,
  selected,
  layout,
  onPress,
}: {
  strategy: BudgetSetupStrategy;
  selected: boolean;
  layout: "regular" | "tight" | "slider";
  onPress: () => void;
}) {
  const copy = BUDGET_SETUP_STRATEGY_COPY[strategy];
  const isCompact = layout !== "regular";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        layout === "regular" ? styles.cardRegular : null,
        layout === "tight" ? styles.cardTight : null,
        layout === "slider" ? styles.cardSlider : null,
        selected ? styles.cardSelected : styles.cardIdle,
        pressed && !selected ? styles.cardPressed : null,
      ]}
    >
      <View style={[styles.cardIconWrap, isCompact && styles.cardIconWrapCompact]}>
        <AppIcon
          name={copy.iconName}
          size={layout === "regular" ? 26 : 20}
          color={selected ? FinColors.warningText : FinColors.textSecondary}
          variant="outlined"
        />
      </View>
      <View style={styles.cardText}>
        <Text
          style={[
            styles.cardTitle,
            layout !== "regular" && styles.cardTitleCompact,
            selected && styles.cardTitleSelected,
          ]}
        >
          {copy.label}
        </Text>
        <Text style={[styles.cardDescription, layout !== "regular" && styles.cardDescriptionCompact]}>
          {copy.shortDescription}
        </Text>
      </View>
    </Pressable>
  );
}

export function BudgetSetupStrategySelector({
  selectedStrategy,
  visibleStrategies,
  onChange,
  eyebrowLabel = "1. AANPAK",
  style,
}: BudgetSetupStrategySelectorProps) {
  const { width } = useWindowDimensions();
  const useSlider = visibleStrategies.length > 3 ? width < 520 : width < 332;
  const useTightRow = !useSlider && width < 440;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.headerRow}>
        <FinanceText variant="label" weight="bold" tone="muted" style={styles.headerLabel}>
          {eyebrowLabel}
        </FinanceText>
      </View>

      {useSlider ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardsSlider}
        >
          {visibleStrategies.map((strategy) => (
            <StrategyCard
              key={strategy}
              strategy={strategy}
              layout="slider"
              selected={strategy === selectedStrategy}
              onPress={() => onChange(strategy)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.cardsRow, useTightRow && styles.cardsRowTight]}>
          {visibleStrategies.map((strategy) => (
            <StrategyCard
              key={strategy}
              strategy={strategy}
              layout={useTightRow ? "tight" : "regular"}
              selected={strategy === selectedStrategy}
              onPress={() => onChange(strategy)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: FinSpacing.s,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: FinSpacing.m,
    paddingHorizontal: FinSpacing.s,
  },
  headerLabel: {
    letterSpacing: 1.8,
  },
  cardsRow: {
    flexDirection: "row",
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
    gap: FinSpacing.xs,
  },
  cardsRowTight: {
    gap: 6,
    paddingVertical: 6,
  },
  cardsSlider: {
    paddingHorizontal: FinSpacing.s,
    paddingVertical: FinSpacing.x1,
    gap: FinSpacing.xs,
  },
  card: {
    minWidth: 0,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: FinColors.bgCard,
    justifyContent: "flex-start",
  },
  cardRegular: {
    flex: 1,
    minWidth: 0,
    minHeight: 136,
    padding: FinSpacing.s,
    gap: FinSpacing.x2,
  },
  cardTight: {
    flex: 1,
    minWidth: 0,
    minHeight: 108,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  cardSlider: {
    width: 148,
    minHeight: 118,
    padding: 10,
    gap: 6,
  },
  cardIdle: {
    borderColor: FinColors.borderSubtle,
  },
  cardSelected: {
    borderWidth: 3,
    borderColor: FinColors.warningText,
    boxShadow: "0px 10px 18px rgba(138,100,0,0.08)",
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgInput,
  },
  cardIconWrapCompact: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  cardText: {
    gap: 2,
  },
  cardTitle: {
    ...FinTypography["body-sm"],
    color: FinColors.textPrimary,
    fontWeight: "800",
  },
  cardTitleCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  cardTitleSelected: {
    color: FinColors.textPrimary,
  },
  cardDescription: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    lineHeight: 15,
  },
  cardDescriptionCompact: {
    fontSize: 10,
    lineHeight: 12,
  },
});
