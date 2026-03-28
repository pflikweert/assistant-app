import { FinanceText } from "@/components/ui/finance-text";
import { FinSurfaces, FinSpacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, type StyleProp, type ViewStyle, View } from "react-native";

type FinanceSettingsGroupProps = {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  cardStyle?: StyleProp<ViewStyle>;
};

export function FinanceSettingsGroup({
  title,
  children,
  style,
  cardStyle,
}: FinanceSettingsGroupProps) {
  return (
    <View style={[styles.wrap, style]}>
      <FinanceText variant="label" weight="bold" tone="muted" style={styles.title}>
        {title}
      </FinanceText>
      <View style={[styles.card, cardStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: FinSpacing.x2,
  },
  title: {
    textTransform: "uppercase",
    paddingHorizontal: FinSpacing.x1,
  },
  card: {
    ...FinSurfaces.topLevelCard,
    borderRadius: 22,
    overflow: "hidden",
  },
});
