import {
  HelpAssistantComposer,
  type HelpAssistantComposerHandle,
} from "@/components/help-assistant/help-assistant-composer";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

type HelpAssistantComposerDockProps = {
  composerRef: React.RefObject<HelpAssistantComposerHandle | null>;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
};

export const HELP_ASSISTANT_COMPOSER_DOCK_HEIGHT = 110;

export function HelpAssistantComposerDock({
  composerRef,
  value,
  onChangeText,
  onSubmit,
}: HelpAssistantComposerDockProps) {
  return (
    <View style={styles.composerDock} pointerEvents="box-none">
      <View style={styles.composerDockGlass} />
      <View style={styles.composerContentWrap}>
        <HelpAssistantComposer
          ref={composerRef}
          value={value}
          onChangeText={onChangeText}
          onSubmit={onSubmit}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  composerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingTop: 14,
    paddingBottom: 4,
  },
  composerDockGlass: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: "rgba(250,251,255,0.74)",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.56)",
    ...(Platform.OS === "web"
      ? ({
          backdropFilter: "blur(10px)",
        } as any)
      : null),
  },
  composerContentWrap: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
});
