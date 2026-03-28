import HeaderDropdownMenu from "@/components/header-dropdown-menu";
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

type FinanceTopBarProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  shellStyle?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  rowStyle?: StyleProp<ViewStyle>;
  leftStyle?: StyleProp<ViewStyle>;
  rightStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  titleWrapStyle?: StyleProp<ViewStyle>;
  showMenu?: boolean;
};

export function FinanceTopBar({
  title,
  subtitle,
  rightSlot,
  children,
  shellStyle,
  innerStyle,
  rowStyle,
  leftStyle,
  rightStyle,
  titleStyle,
  subtitleStyle,
  titleWrapStyle,
  showMenu = true,
}: FinanceTopBarProps) {
  return (
    <View style={[styles.shell, shellStyle]}>
      <View style={[styles.inner, innerStyle]}>
        <View style={[styles.row, rowStyle]}>
          <View style={[styles.left, leftStyle]}>
            {showMenu ? <HeaderDropdownMenu /> : null}
            <View style={[styles.titleWrap, titleWrapStyle]}>
              <Text style={[styles.title, titleStyle]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, subtitleStyle]}>{subtitle}</Text>
              ) : null}
            </View>
          </View>
          {rightSlot ? <View style={[styles.right, rightStyle]}>{rightSlot}</View> : null}
        </View>
        {children ? <View style={styles.children}>{children}</View> : null}
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
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
    flex: 1,
  },
  titleWrap: {
    flexShrink: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: FinColors.textPrimary,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: FinSpacing.x1 / 2,
    fontSize: 14,
    color: FinColors.textSecondary,
  },
  right: {
    flexShrink: 0,
  },
  children: {
    marginTop: FinSpacing.x4,
  },
});
