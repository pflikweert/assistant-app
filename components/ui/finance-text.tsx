import { FinTokens } from "@/constants/theme";
import React from "react";
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from "react-native";

export type FinanceTextVariant = keyof typeof FinTokens.typography;
export type FinanceTextTone =
  | "primary"
  | "secondary"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger";
export type FinanceTextWeight = keyof typeof FinTokens.fontWeight;

type FinanceTextProps = Pick<TextProps, "numberOfLines" | "ellipsizeMode" | "testID"> & {
  children: React.ReactNode;
  variant?: FinanceTextVariant;
  tone?: FinanceTextTone;
  weight?: FinanceTextWeight;
  align?: "auto" | "left" | "center" | "right" | "justify";
  style?: StyleProp<TextStyle>;
};

const toneStyles = StyleSheet.create({
  primary: { color: FinTokens.color.textPrimary },
  secondary: { color: FinTokens.color.textSecondary },
  muted: { color: FinTokens.color.textMuted },
  accent: { color: FinTokens.color.accentText },
  success: { color: FinTokens.color.success },
  warning: { color: FinTokens.color.warning },
  danger: { color: FinTokens.color.danger },
});

export function FinanceText({
  children,
  variant = "body",
  tone = "primary",
  weight = "regular",
  align = "left",
  style,
  numberOfLines,
  ellipsizeMode,
  testID,
}: FinanceTextProps) {
  const variantToken = FinTokens.typography[variant];
  const fontWeight = FinTokens.fontWeight[weight] as TextStyle["fontWeight"];

  return (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      ellipsizeMode={ellipsizeMode}
      style={[
        styles.base,
        {
          fontSize: variantToken.fontSize,
          lineHeight: variantToken.lineHeight,
          letterSpacing: variantToken.letterSpacing,
          textAlign: align,
          fontWeight,
        },
        toneStyles[tone],
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: FinTokens.color.textPrimary,
  },
});
