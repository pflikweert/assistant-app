import { HelpAssistantComposer } from "@/components/help-assistant/help-assistant-composer";
import { HelpAssistantEmptyThread } from "@/components/help-assistant/help-assistant-empty-thread";
import { HelpAssistantMarkdown } from "@/components/help-assistant/help-assistant-markdown";
import { HelpAssistantQuickActions } from "@/components/help-assistant/help-assistant-quick-actions";
import {
  applyQuickActionLocally,
  createInitialHelpAssistantThreadState,
  type HelpAssistantThreadState,
  resolveAssistantMessageError,
  resolveAssistantMessageSuccess,
  submitComposerMessageLocally,
} from "@/services/help-assistant-chat";
import {
  isFinancialAdviceQuestion,
  requestHelpAssistantReply,
} from "@/services/help-assistant-ai";
import type { UnifiedFinancialAdviceContext } from "@/services/help-assistant-financial-context";
import {
  listHelpAssistantQuickActions,
  type HelpAssistantQuickAction,
} from "@/services/help-assistant-quick-actions";
import {
  type HelpAssistantContext,
} from "@/services/help-assistant-context";
import { FinanceBottomSheetShell } from "@/components/ui/finance-bottom-sheet-shell";
import { FinColors } from "@/constants/theme";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type HelpAssistantSheetProps = {
  visible: boolean;
  context: HelpAssistantContext;
  onClose: () => void;
};

export function HelpAssistantSheet({
  visible,
  context,
  onClose,
}: HelpAssistantSheetProps) {
  const [composerValue, setComposerValue] = React.useState("");
  const [thread, setThread] = React.useState(createInitialHelpAssistantThreadState);
  const [sessionFinancialContext, setSessionFinancialContext] =
    React.useState<UnifiedFinancialAdviceContext | null>(null);
  const threadRef = React.useRef(thread);
  const scrollRef = React.useRef<ScrollView>(null);
  const quickActions = React.useMemo(
    () => listHelpAssistantQuickActions(context),
    [context],
  );
  const latestMessageCursor = React.useMemo(() => {
    const message = thread.messages[thread.messages.length - 1];
    if (!message) return "0";
    return `${thread.messages.length}:${message.id}:${message.status}:${message.text.length}`;
  }, [thread.messages]);

  React.useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  const scrollToLatestMessage = React.useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  React.useEffect(() => {
    if (!visible) return;
    scrollToLatestMessage();
  }, [latestMessageCursor, scrollToLatestMessage, visible]);

  React.useEffect(() => {
    if (visible) return;
    setSessionFinancialContext(null);
  }, [visible]);

  const requestAssistantReply = React.useCallback(
    async (placeholderId: string, threadSnapshot: HelpAssistantThreadState) => {
      const latestUserMessage = [...threadSnapshot.messages]
        .reverse()
        .find((message) => message.role === "user");
      const shouldUseFinancialSessionContext = Boolean(
        latestUserMessage && isFinancialAdviceQuestion(latestUserMessage.text),
      );

      try {
        const reply = await requestHelpAssistantReply({
          context,
          thread: threadSnapshot,
          unifiedFinancialContext: shouldUseFinancialSessionContext
            ? sessionFinancialContext
            : null,
        });
        if (
          shouldUseFinancialSessionContext &&
          !sessionFinancialContext &&
          reply.unifiedFinancialContext
        ) {
          setSessionFinancialContext(reply.unifiedFinancialContext);
        }
        setThread((current) =>
          resolveAssistantMessageSuccess(
            current,
            placeholderId,
            reply.answerText,
            reply.model,
          ),
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Hulpassistent kon geen antwoord ophalen.";
        setThread((current) =>
          resolveAssistantMessageError(current, placeholderId, message),
        );
      }
    },
    [context, sessionFinancialContext],
  );

  const handleQuickActionPress = React.useCallback(
    (action: HelpAssistantQuickAction) => {
      if (action.behavior === "prefill_composer") {
        setComposerValue(action.seedText);
        return;
      }

      setComposerValue("");
      const result = applyQuickActionLocally(threadRef.current, context, action);
      setThread(result.thread);
      if (result.assistantPlaceholderId) {
        void requestAssistantReply(result.assistantPlaceholderId, result.thread);
      }
    },
    [context, requestAssistantReply],
  );

  const handleSubmit = React.useCallback(() => {
    const result = submitComposerMessageLocally(
      threadRef.current,
      context,
      composerValue,
    );
    setThread(result.thread);
    setComposerValue("");
    if (result.assistantPlaceholderId) {
      void requestAssistantReply(result.assistantPlaceholderId, result.thread);
    }
  }, [composerValue, context, requestAssistantReply]);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      title="Hulpassistent"
      onClose={onClose}
      bodyStyle={styles.bodyShell}
      footerStyle={styles.footer}
      footer={
        <HelpAssistantComposer
          value={composerValue}
          onChangeText={setComposerValue}
          onSubmit={handleSubmit}
        />
      }
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (!visible) return;
          scrollToLatestMessage();
        }}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Snelle acties</Text>
          <HelpAssistantQuickActions
            actions={quickActions}
            onPressAction={handleQuickActionPress}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Gesprek</Text>
          {thread.messages.length === 0 ? (
            <HelpAssistantEmptyThread />
          ) : (
            <View style={styles.threadWrap}>
              {thread.messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.threadBubble,
                    message.role === "user"
                      ? styles.threadBubbleUser
                      : styles.threadBubbleAssistant,
                  ]}
                >
                  <HelpAssistantMarkdown
                    text={message.text}
                    tone={message.role === "user" ? "user" : "assistant"}
                  />
                  <Text style={styles.threadMeta}>
                    {message.role === "assistant" ? "Assistent" : "Jij"} ·{" "}
                    {message.metadata.source}
                    {message.metadata.issueDraftCandidate
                      ? " · issue-kandidaat"
                      : ""}
                    {message.metadata.spendingAdviceCandidate
                      ? " · spending-vraag"
                      : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </FinanceBottomSheetShell>
  );
}

const styles = StyleSheet.create({
  bodyShell: {
    marginTop: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: 18,
    paddingBottom: 8,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontWeight: "700",
    color: FinColors.textMuted,
  },
  threadWrap: {
    gap: 8,
  },
  threadBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  threadBubbleUser: {
    alignSelf: "flex-end",
    maxWidth: "86%",
    borderColor: FinColors.warningBorder,
    backgroundColor: FinColors.yellowSoft,
  },
  threadBubbleAssistant: {
    alignSelf: "flex-start",
    maxWidth: "90%",
    borderColor: FinColors.borderSubtle,
    backgroundColor: FinColors.bgCard,
  },
  threadMeta: {
    marginTop: 6,
    fontSize: 11,
    color: FinColors.textMuted,
  },
  footer: {
    marginTop: 12,
  },
});
