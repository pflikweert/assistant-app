import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

type FinanceDetailTopBarProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onBack: () => void;
  shellStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function FinanceDetailTopBar({
  title,
  subtitle,
  onBack,
  shellStyle,
  innerStyle,
  titleStyle,
  subtitleStyle,
}: FinanceDetailTopBarProps) {
  return (
    <View style={[styles.shell, shellStyle]}>
      <View style={[styles.inner, innerStyle]}>
        <View style={styles.row}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Ga terug"
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <AppIcon
              name="arrow-back"
              size={18}
              color={FinColors.textPrimary}
              variant="outlined"
            />
          </Pressable>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
            ) : null}
          </View>

          <View style={styles.rightSlot}>
            <HeaderDropdownMenu />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "rgba(246,245,242,0.92)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.08)",
    boxShadow: "0px 8px 16px rgba(17,17,17,0.04)",
    elevation: 1,
  },
  inner: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    opacity: 0.86,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  rightSlot: {
    flexShrink: 0,
  },
});
