import { FinColors } from "@/constants/theme";
import React from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

type FinanceDetailCardTone = "default" | "subtle" | "warning";

type FinanceDetailCardProps = {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  rightSlot?: React.ReactNode;
  tone?: FinanceDetailCardTone;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function FinanceDetailCard({
  title,
  subtitle,
  rightSlot,
  tone = "default",
  children,
  style,
  headerStyle,
  bodyStyle,
  titleStyle,
  subtitleStyle,
}: FinanceDetailCardProps) {
  return (
    <View style={[styles.card, toneStyles[tone], style]}>
      {title || subtitle || rightSlot ? (
        <View style={[styles.header, headerStyle]}>
          <View style={styles.headerText}>
            {title ? <Text style={[styles.title, titleStyle]}>{title}</Text> : null}
            {subtitle ? (
              <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
            ) : null}
          </View>
          {rightSlot ? <View style={styles.headerRight}>{rightSlot}</View> : null}
        </View>
      ) : null}
      {children ? <View style={[styles.body, bodyStyle]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: FinColors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: FinColors.textSecondary,
  },
  headerRight: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  body: {
    gap: 12,
  },
});

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: FinColors.bgCard,
    borderColor: FinColors.borderSubtle,
  },
  subtle: {
    backgroundColor: FinColors.bgInput,
    borderColor: FinColors.borderSubtle,
  },
  warning: {
    backgroundColor: FinColors.warningBg,
    borderColor: FinColors.warningBorder,
  },
} satisfies Record<FinanceDetailCardTone, ViewStyle>);
