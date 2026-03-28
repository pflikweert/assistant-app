import { FinTokens } from "@/constants/theme";
import React from "react";
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { FinanceTopBar } from "@/components/ui/finance-top-bar";

type FinanceDashboardHeaderProps = {
  title: React.ReactNode;
  rightSlot?: React.ReactNode;
  children?: React.ReactNode;
  topBarStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function FinanceDashboardHeader({
  title,
  rightSlot,
  children,
  topBarStyle,
  contentStyle,
}: FinanceDashboardHeaderProps) {
  return (
    <View style={styles.root}>
      <FinanceTopBar shellStyle={topBarStyle} title={title} rightSlot={rightSlot} />
      {children ? (
        <View style={[styles.content, contentStyle]}>
          <View style={styles.contentInner}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  content: {
    paddingHorizontal: FinTokens.spacing.m,
    paddingTop: FinTokens.spacing.s,
  },
  contentInner: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
  },
});
