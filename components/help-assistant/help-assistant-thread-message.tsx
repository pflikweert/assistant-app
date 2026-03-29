import { AiAssistantResponse } from "@/components/help-assistant/ai-assistant-response";
import { HelpAssistantMarkdown } from "@/components/help-assistant/help-assistant-markdown";
import { FinanceAssistantMotionGlyph } from "@/components/motions/finance-assistant-motion-glyph";
import { FinColors } from "@/constants/theme";
import type { HelpAssistantMessage } from "@/services/help-assistant-chat";
import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type HelpAssistantThreadMessageProps = {
  message: HelpAssistantMessage;
  visible: boolean;
  isLatestAssistant: boolean;
  liveTypingMessageId: string | null;
  typedCompleted: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  onTypingComplete: (messageId: string) => void;
};

export function HelpAssistantThreadMessage({
  message,
  visible,
  isLatestAssistant,
  liveTypingMessageId,
  typedCompleted,
  containerStyle,
  onLayout,
  onTypingComplete,
}: HelpAssistantThreadMessageProps) {
  const isAssistant = message.role === "assistant";
  const isPending = message.status === "pending";
  const isReady = message.status === "ready";
  const shouldRenderLiveAssistant =
    isAssistant &&
    isLatestAssistant &&
    message.id === liveTypingMessageId &&
    isReady &&
    !typedCompleted;

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.threadBubble,
        message.role === "user"
          ? styles.threadBubbleUser
          : styles.threadBubbleAssistant,
        containerStyle,
      ]}
    >
      {isAssistant ? (
        <View style={styles.assistantMessageWrap}>
          <View style={styles.assistantHeaderRow}>
            <View style={styles.assistantAvatar}>
              <FinanceAssistantMotionGlyph
                size={14}
                color={FinColors.textPrimary}
                disabled={!visible}
              />
            </View>
            <Text style={styles.assistantLabel}>BUDIO</Text>
          </View>

          {isPending ? (
            <AiAssistantResponse
              isLoading
              text=""
              theme={{
                primary: FinColors.green,
                text: FinColors.textPrimary,
              }}
              style={styles.assistantLiveResponse}
            />
          ) : (
            <View style={styles.assistantBubbleSurface}>
              {shouldRenderLiveAssistant ? (
                <AiAssistantResponse
                  isLoading={false}
                  text={message.text}
                  theme={{
                    primary: FinColors.green,
                    text: FinColors.textPrimary,
                  }}
                  onTypingComplete={() => onTypingComplete(message.id)}
                  style={styles.assistantLiveResponse}
                />
              ) : (
                <HelpAssistantMarkdown
                  text={message.text}
                  tone="assistant"
                />
              )}
            </View>
          )}
        </View>
      ) : (
        <View style={styles.userMessageWrap}>
          <HelpAssistantMarkdown
            text={message.text}
            tone="user"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  threadBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  threadBubbleUser: {
    alignSelf: "flex-end",
    maxWidth: "78%",
    borderWidth: 1,
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.yellowSoft,
  },
  threadBubbleAssistant: {
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: "92%",
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 2,
    borderRadius: 0,
  },
  assistantMessageWrap: {
    gap: 8,
  },
  assistantHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
  },
  assistantLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
    color: FinColors.textMuted,
  },
  assistantBubbleSurface: {
    borderRadius: 28,
    backgroundColor: "#e9e9ea",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  assistantLiveResponse: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  userMessageWrap: {
    gap: 0,
  },
});
