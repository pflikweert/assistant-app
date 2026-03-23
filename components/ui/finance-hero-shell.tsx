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

type FinanceHeroShellProps = {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children?: React.ReactNode;
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
  shellStyle,
  innerStyle,
  titleStyle,
  subtitleStyle,
  eyebrowStyle,
  subtitleLineStyle,
}: FinanceHeroShellProps) {
  return (
    <View style={[styles.shell, shellStyle]}>
      <View style={[styles.inner, innerStyle]}>
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
    borderBottomColor: "rgba(17,17,17,0.05)",
  },
  inner: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 102,
    paddingBottom: 24,
  },
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
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
    marginTop: 12,
    borderLeftWidth: 2,
    borderLeftColor: FinColors.border,
    paddingLeft: 14,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: FinColors.textSecondary,
  },
  children: {
    marginTop: 16,
  },
});
