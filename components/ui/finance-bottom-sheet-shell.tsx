import { AppIcon } from "@/components/ui/app-icon";
import { FinColors, FinRadius, FinSpacing } from "@/constants/theme";
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
  headerAccessory?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
  bodyStyle?: StyleProp<ViewStyle>;
  footerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  subtitleStyle?: StyleProp<TextStyle>;
  presentation?: "sheet" | "fullscreen";
};

export function FinanceBottomSheetShell({
  visible,
  title,
  subtitle,
  headerAccessory,
  onClose,
  children,
  footer,
  sheetStyle,
  bodyStyle,
  footerStyle,
  titleStyle,
  subtitleStyle,
  presentation = "sheet",
}: FinanceBottomSheetShellProps) {
  const isFullscreen = presentation === "fullscreen";
  const hasTitle = !(
    title === null ||
    title === undefined ||
    (typeof title === "string" && title.trim().length === 0)
  );

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
        <View
          style={[
            styles.sheet,
            isFullscreen && styles.fullscreenSheet,
            sheetStyle,
          ]}
        >
          {!isFullscreen ? <View style={styles.handle} /> : null}

          <View style={styles.headerRow}>
            <View style={styles.headerMain}>
              {hasTitle ? (
                <Text style={[styles.title, titleStyle]}>{title}</Text>
              ) : null}
              {subtitle ? (
                <Text style={[styles.subtitle, subtitleStyle]}>
                  {subtitle}
                </Text>
              ) : null}
            </View>

            <View style={styles.headerActions}>
              {headerAccessory ? (
                <View style={styles.headerAccessoryWrap}>{headerAccessory}</View>
              ) : null}
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
    borderTopLeftRadius: FinRadius.sheet,
    borderTopRightRadius: FinRadius.sheet,
    backgroundColor: FinColors.bgBase,
    paddingHorizontal: FinSpacing.x6,
    paddingTop: FinSpacing.x3,
    paddingBottom: 18,
    boxShadow: "0px -12px 32px rgba(17,17,17,0.10)",
    elevation: 18,
  },
  fullscreenSheet: {
    maxHeight: "100%",
    minHeight: "100%",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingTop: FinSpacing.x6,
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
    gap: FinSpacing.x4,
  },
  headerMain: {
    flex: 1,
    gap: FinSpacing.x2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: FinSpacing.x3,
  },
  headerAccessoryWrap: {
    alignItems: "flex-end",
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
    borderRadius: FinRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.bgInput,
  },
  closeButtonPressed: {
    opacity: 0.86,
  },
  body: {
    flex: 1,
    minHeight: 0,
    marginTop: FinSpacing.x6,
  },
  footer: {
    marginTop: FinSpacing.x5,
  },
});
