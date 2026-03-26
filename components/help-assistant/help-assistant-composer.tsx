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
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Typ je vraag..."
        placeholderTextColor={FinColors.textMuted}
        multiline
        textAlignVertical="top"
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
          name="north-east"
          size={18}
          color={FinColors.textPrimary}
          variant="outlined"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 72,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    minHeight: 50,
    maxHeight: 120,
    color: FinColors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.yellowSoft,
  },
  sendButtonPressed: {
    opacity: 0.84,
  },
});
