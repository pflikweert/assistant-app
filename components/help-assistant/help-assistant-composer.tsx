import { AppIcon } from "@/components/ui/app-icon";
import { FinColors } from "@/constants/theme";
import React from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

type HelpAssistantComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
};

export function HelpAssistantComposer({
  value,
  onChangeText,
  onSubmit,
}: HelpAssistantComposerProps) {
  const handleSubmit = React.useCallback(() => {
    if (!value.trim()) return;
    onSubmit();
  }, [onSubmit, value]);

  return (
    <View style={styles.shell}>
      <View style={styles.leadingIconWrap}>
        <AppIcon
          name="format-list-bulleted"
          size={16}
          color={FinColors.textMuted}
          variant="outlined"
        />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Stel je vraag aan Budio..."
        placeholderTextColor="rgba(95,90,84,0.55)"
        multiline={false}
        textAlignVertical="center"
        returnKeyType="send"
        submitBehavior="submit"
        onSubmitEditing={handleSubmit}
        onKeyPress={(event) => {
          if (Platform.OS !== "web") return;
          const native = event.nativeEvent as unknown as {
            key?: string;
            shiftKey?: boolean;
          };
          if (native.key === "Enter" && !native.shiftKey) {
            handleSubmit();
          }
        }}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Verstuur bericht"
        onPress={handleSubmit}
        style={({ pressed }) => [styles.sendButton, pressed && styles.sendButtonPressed]}
      >
        <AppIcon
          name="north"
          size={18}
          color="#ffffff"
          variant="outlined"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 999,
    borderWidth: 0,
    backgroundColor: "#ffffff",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 58,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    outlineWidth: 0,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as any)
      : null),
  },
  leadingIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 40,
    color: FinColors.textPrimary,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "400",
    paddingTop: 0,
    paddingBottom: 0,
    outlineWidth: 0,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as any)
      : null),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.warningText,
    outlineWidth: 0,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as any)
      : null),
  },
  sendButtonPressed: {
    opacity: 0.9,
  },
});
