import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import {
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  View,
} from "react-native";

type FinanceBottomSheetShellProps = {
  visible: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
};

export function FinanceBottomSheetShell({
  visible,
  title,
  subtitle,
  onClose,
  children,
  footer,
  sheetStyle,
  bodyStyle,
  footerStyle,
  titleStyle,
  subtitleStyle,
}: FinanceBottomSheetShellProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={[
            styles.backdrop,
            Platform.OS === "web" ? ({ backdropFilter: "blur(14px)" } as any) : null,
          ]}
          onPress={onClose}
        />
        <View style={[styles.sheet, sheetStyle]}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              <Text style={[styles.title, titleStyle]}>{title}</Text>
              {subtitle ? (
                <Text style={[styles.subtitle, subtitleStyle]}>
                  {subtitle}
                </Text>
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
                size={22}
                color={FinColors.textSecondary}
                variant="outlined"
              />
            </Pressable>
          </View>

          <View style={[styles.body, bodyStyle]}>{children}</View>

          {footer ? <View style={[styles.footer, footerStyle]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(17,17,17,0.42)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: "#f5f6f7",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 18,
    boxShadow: "0px -12px 32px rgba(17,17,17,0.10)",
    elevation: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.12)",
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  headerMain: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 29,
    lineHeight: 33,
    color: FinColors.textPrimary,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: FinColors.textSecondary,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff1f2",
  },
  closeButtonPressed: {
    opacity: 0.86,
  },
  body: {
    flex: 1,
    minHeight: 0,
    marginTop: 24,
  },
  footer: {
    marginTop: 20,
  },
});
