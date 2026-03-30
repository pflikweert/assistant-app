import { FinColors, FinSpacing } from "@/constants/theme";
import React from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

type FinanceHeroShellProps = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
  layout?: "default" | "utility";
  shellStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  eyebrowStyle?: StyleProp<TextStyle>;
  subtitleLineStyle?: StyleProp<ViewStyle>;
};

export function FinanceHeroShell({
  eyebrow,
  title,
  subtitle,
  children,
  layout = "default",
  shellStyle,
  innerStyle,
  titleStyle,
  subtitleStyle,
  eyebrowStyle,
  subtitleLineStyle,
}: FinanceHeroShellProps) {
  const shellLayoutStyle = layout === "utility" ? styles.utilityShell : styles.shell;
  const innerLayoutStyle = layout === "utility" ? styles.utilityInner : styles.inner;

  return (
    <View style={[shellLayoutStyle, shellStyle]}>
      <View style={[innerLayoutStyle, innerStyle]}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={[styles.eyebrow, eyebrowStyle]}>{eyebrow}</Text>
        </View>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
        <View style={[styles.subtitleWrap, subtitleLineStyle]}>
          <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
        </View>
        {children ? <View style={styles.children}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: FinColors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
  },
  utilityShell: {
    backgroundColor: FinColors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: FinColors.borderSubtle,
    width: "100%",
  },
  inner: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: FinSpacing.x4,
    paddingTop: 102,
    paddingBottom: FinSpacing.x6,
  },
  utilityInner: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: FinSpacing.x4,
    paddingTop: FinSpacing.x6,
    paddingBottom: FinSpacing.x5,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
    marginBottom: FinSpacing.x2,
  },
  eyebrowDot: {
    width: 8,
    height: 8,
    backgroundColor: FinColors.warningText,
  },
  eyebrow: {
    fontSize: 10,
    lineHeight: 14,
    color: FinColors.textMuted,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  title: {
    fontSize: 52,
    lineHeight: 54,
    fontWeight: "900",
    color: FinColors.textPrimary,
    letterSpacing: -1.8,
  },
  subtitleWrap: {
    marginTop: FinSpacing.x3,
    borderLeftWidth: 2,
    borderLeftColor: FinColors.border,
    paddingLeft: FinSpacing.x3,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: FinColors.textSecondary,
  },
  children: {
    marginTop: FinSpacing.x4,
  },
});
