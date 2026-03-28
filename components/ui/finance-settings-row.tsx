import { AppIcon, type AppIconName } from "@/components/ui/app-icon";
import { FinancePressableSurface } from "@/components/ui/finance-pressable-surface";
import { FinanceText } from "@/components/ui/finance-text";
import { FinColors, FinIconSize, FinSpacing } from "@/constants/theme";
import React from "react";
import { StyleSheet, View } from "react-native";

type FinanceSettingsRowProps = {
  label: string;
  subtitle?: string;
  value?: string;
  iconName?: AppIconName;
  onPress?: () => void;
  rightElement?: React.ReactNode;
};

export function FinanceSettingsRow({
  label,
  subtitle,
  value,
  iconName,
  onPress,
  rightElement,
}: FinanceSettingsRowProps) {
  return (
    <FinancePressableSurface
      style={styles.row}
      pressedStyle={styles.rowPressed}
      onPress={onPress}
      disabled={!onPress}
    >
      {iconName ? (
        <View style={styles.rowIconWrap}>
          <AppIcon
            name={iconName}
            size={FinIconSize.sm}
            color={FinColors.textSecondary}
            variant="outlined"
          />
        </View>
      ) : null}
      <View style={styles.rowContent}>
        <FinanceText variant="body-sm" weight="bold" tone="primary">
          {label}
        </FinanceText>
        {subtitle ? (
          <FinanceText variant="caption" tone="secondary">
            {subtitle}
          </FinanceText>
        ) : null}
      </View>
      {rightElement ?? (
        <View style={styles.rowRight}>
          {value ? (
            <FinanceText variant="caption" tone="secondary">
              {value}
            </FinanceText>
          ) : null}
          {onPress ? (
            <AppIcon
              name="chevron-right"
              size={FinIconSize.sm}
              color={FinColors.textSecondary}
              variant="outlined"
            />
          ) : null}
        </View>
      )}
    </FinancePressableSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: FinSpacing.x4,
    paddingVertical: FinSpacing.x3,
    gap: FinSpacing.x3,
    backgroundColor: FinColors.bgCard,
  },
  rowPressed: {
    backgroundColor: FinColors.bgInput,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgInput,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
  },
  rowContent: {
    flex: 1,
    gap: FinSpacing.x1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
  },
});
