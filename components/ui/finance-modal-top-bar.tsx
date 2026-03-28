import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
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

type FinanceModalTopBarProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  shellStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function FinanceModalTopBar({
  title,
  subtitle,
  onClose,
  shellStyle,
  innerStyle,
  titleStyle,
  subtitleStyle,
}: FinanceModalTopBarProps) {
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
          <View style={styles.titleWrap}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
            {subtitle ? (
              <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
            ) : null}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Sluit venster"
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <AppIcon
              name="close"
              size={18}
              color={FinColors.textPrimary}
              variant="outlined"
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: FinColors.topBarBg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(17,17,17,0.10)",
    boxShadow: "0px 10px 20px rgba(17,17,17,0.06)",
    elevation: 2,
  },
  inner: {
    width: "100%",
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    opacity: 0.86,
  },
});
