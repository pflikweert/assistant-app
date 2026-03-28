import HeaderDropdownMenu from "@/components/header-dropdown-menu";
import { AppIcon } from "@/components/ui/app-icon";
import { FinColors, FinSpacing } from "@/constants/theme";
import React from "react";
import {
  Platform,
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
  rightSlot?: React.ReactNode;
  shellStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function FinanceDetailTopBar({
  title,
  subtitle,
  onBack,
  rightSlot,
  shellStyle,
  innerStyle,
  titleStyle,
  subtitleStyle,
}: FinanceDetailTopBarProps) {
  return (
    <View
      style={[
        styles.shell,
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as any)
          : null,
        shellStyle,
      ]}
    >
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
            {rightSlot ? <View style={styles.rightExtra}>{rightSlot}</View> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: "rgba(246,245,242,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.10)",
    boxShadow: "0px 10px 20px rgba(17,17,17,0.06)",
    elevation: 2,
  },
  inner: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    paddingHorizontal: FinSpacing.x4,
    paddingTop: 14,
    paddingBottom: FinSpacing.x3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: FinSpacing.x3,
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
    gap: FinSpacing.x1 / 2,
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
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x2,
  },
  rightExtra: {
    flexShrink: 0,
  },
});
