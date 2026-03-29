import { FinColors, FinRadius, FinSpacing, FinTypography } from "@/constants/theme";
import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";

type FinanceInputFieldProps = TextInputProps & {
  label?: string;
  hint?: string | null;
  error?: string | null;
  containerStyle?: TextInputProps["style"];
};

export function FinanceInputField({
  label,
  hint,
  error,
  containerStyle,
  editable = true,
  ...inputProps
}: FinanceInputFieldProps) {
  return (
    <View style={styles.block}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...inputProps}
        editable={editable}
        placeholderTextColor={inputProps.placeholderTextColor ?? FinColors.textMuted}
        style={[
          styles.input,
          !editable ? styles.inputDisabled : null,
          error ? styles.inputError : null,
          containerStyle,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hintText}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: FinSpacing.x2,
  },
  label: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(17,17,17,0.03)",
    borderRadius: FinRadius.pill,
    paddingHorizontal: FinSpacing.l,
    paddingVertical: FinSpacing.m,
    minHeight: 58,
    ...FinTypography.body,
    color: FinColors.textPrimary,
    backgroundColor: FinColors.bgInput,
  },
  inputDisabled: {
    opacity: 0.72,
  },
  inputError: {
    borderColor: FinColors.redBorder,
    backgroundColor: FinColors.redBg,
  },
  hintText: {
    ...FinTypography.caption,
    color: FinColors.textSecondary,
    paddingHorizontal: FinSpacing.x1,
  },
  errorText: {
    color: FinColors.red,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: FinSpacing.x1,
  },
});
