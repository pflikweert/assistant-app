import { useSession } from "@/app/_layout";
import { HelpAssistantComposer } from "@/components/help-assistant/help-assistant-composer";
import { AiAssistantResponse } from "@/components/help-assistant/ai-assistant-response";
import { HelpAssistantEmptyThread } from "@/components/help-assistant/help-assistant-empty-thread";
import { HelpAssistantIssueDraftPreviewCard } from "@/components/help-assistant/help-assistant-issue-draft-preview";
import { HelpAssistantMarkdown } from "@/components/help-assistant/help-assistant-markdown";
import { HelpAssistantQuickActions } from "@/components/help-assistant/help-assistant-quick-actions";
import { AppIcon } from "@/components/ui/app-icon";
import {
  applyQuickActionLocally,
  appendLocalAssistantInfoMessage,
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
  createInitialHelpAssistantIssueFlowState,
  helpAssistantIssueFlowReducer,
  type HelpAssistantIssueFlowStructuredResponse,
} from "@/services/help-assistant-issue-flow";
import { createHelpAssistantIssueFromDraft } from "@/services/help-assistant-issue-submit";
import {
  listHelpAssistantQuickActions,
  type HelpAssistantQuickAction,
} from "@/services/help-assistant-quick-actions";
import {
  resolveHelpAssistantFirstName,
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
  const { user } = useSession();
  const [composerValue, setComposerValue] = React.useState("");
  const [thread, setThread] = React.useState(createInitialHelpAssistantThreadState);
  const [sessionFinancialContext, setSessionFinancialContext] =
    React.useState<UnifiedFinancialAdviceContext | null>(null);
  const [typedCompletedByMessageId, setTypedCompletedByMessageId] =
    React.useState<Record<string, boolean>>({});
  const [creatingIssue, setCreatingIssue] = React.useState(false);
  const [issueFlowState, dispatchIssueFlow] = React.useReducer(
    helpAssistantIssueFlowReducer,
    undefined,
    createInitialHelpAssistantIssueFlowState,
  );
  const latestStructuredIssueResponseRef =
    React.useRef<HelpAssistantIssueFlowStructuredResponse | null>(null);
  const composerValueRef = React.useRef(composerValue);
  const issueFlowStateRef = React.useRef(issueFlowState);
  const issueRequestAnchorRef = React.useRef<string | null>(null);
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
  const latestAssistantMessageId = React.useMemo(() => {
    const latestAssistantMessage = [...thread.messages]
      .reverse()
      .find((message) => message.role === "assistant");
    return latestAssistantMessage?.id ?? null;
  }, [thread.messages]);
  const userFirstName = React.useMemo(
    () => resolveHelpAssistantFirstName(user),
    [user],
  );
  const greetingTitle = userFirstName ? `Hoi ${userFirstName},` : "Hoi,";
  const userMessageLabel = userFirstName
    ? userFirstName.toUpperCase()
    : "JIJ";
  const shouldShowQuickActions = thread.messages.length === 0;
  const activeIssueDraft =
    issueFlowState.activeDraft && issueFlowState.status !== "idle"
      ? issueFlowState.activeDraft
      : null;
  const shouldShowIssueDraftPreview = Boolean(activeIssueDraft);

  React.useEffect(() => {
    threadRef.current = thread;
  }, [thread]);

  React.useEffect(() => {
    composerValueRef.current = composerValue;
  }, [composerValue]);

  React.useEffect(() => {
    issueFlowStateRef.current = issueFlowState;
  }, [issueFlowState]);

  React.useEffect(() => {
    if (!visible) return;
    if (
      issueFlowState.status === "submitted" ||
      issueFlowState.status === "cancelled"
    ) {
      return;
    }

    const hasActiveIssueFlow = Boolean(
      latestStructuredIssueResponseRef.current ||
        issueFlowState.status === "collecting" ||
        issueFlowState.status === "ready_to_review" ||
        issueFlowState.status === "submitting",
    );

    if (!hasActiveIssueFlow) return;

    dispatchIssueFlow({
      type: "sync",
      thread,
      context,
      composerValue,
      structuredResponse: latestStructuredIssueResponseRef.current,
      anchorMessageId: issueFlowState.anchorMessageId || undefined,
    });
  }, [
    composerValue,
    context,
    issueFlowState.anchorMessageId,
    issueFlowState.status,
    thread,
    visible,
  ]);

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
    setTypedCompletedByMessageId({});
    setCreatingIssue(false);
    latestStructuredIssueResponseRef.current = null;
    issueRequestAnchorRef.current = null;
    dispatchIssueFlow({ type: "reset" });
  }, [visible]);

  const requestAssistantReply = React.useCallback(
    async (placeholderId: string, threadSnapshot: HelpAssistantThreadState) => {
      const latestUserMessage = [...threadSnapshot.messages]
        .reverse()
        .find((message) => message.role === "user");
      const requestAnchorMessageId = latestUserMessage?.id || null;
      issueRequestAnchorRef.current = requestAnchorMessageId;
      const shouldUseFinancialSessionContext = Boolean(
        latestUserMessage && isFinancialAdviceQuestion(latestUserMessage.text),
      );

      try {
        const reply = await requestHelpAssistantReply({
          context,
          thread: threadSnapshot,
          issueFlowActive:
            issueFlowStateRef.current.status === "collecting" ||
            issueFlowStateRef.current.status === "ready_to_review" ||
            issueFlowStateRef.current.status === "submitting",
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
        if (
          reply.issueIntake &&
          requestAnchorMessageId &&
          issueRequestAnchorRef.current === requestAnchorMessageId
        ) {
          latestStructuredIssueResponseRef.current = reply.issueIntake;
          dispatchIssueFlow({
            type: "sync",
            thread: threadSnapshot,
            context,
            composerValue: composerValueRef.current,
            structuredResponse: reply.issueIntake,
            anchorMessageId: requestAnchorMessageId,
          });
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
      setComposerValue("");
      const directSendAction: HelpAssistantQuickAction = {
        ...action,
        behavior: "start_local_thread",
      };
      const result = applyQuickActionLocally(
        threadRef.current,
        context,
        directSendAction,
      );
      setThread(result.thread);
      if (result.assistantPlaceholderId) {
        void requestAssistantReply(result.assistantPlaceholderId, result.thread);
      }
    },
    [context, requestAssistantReply],
  );

  const handleCreateIssueDraft = React.useCallback(async () => {
    if (!activeIssueDraft) return;
    if (
      issueFlowState.status === "submitted" ||
      issueFlowState.status === "cancelled"
    ) {
      return;
    }
    if (creatingIssue) return;
    setCreatingIssue(true);
    dispatchIssueFlow({ type: "request_submit" });
    try {
      await createHelpAssistantIssueFromDraft(activeIssueDraft);
      dispatchIssueFlow({ type: "mark_submitted" });
      latestStructuredIssueResponseRef.current = null;
      issueRequestAnchorRef.current = null;
      setThread((current) =>
        appendLocalAssistantInfoMessage({
          thread: current,
          context,
          text: "Ik heb dit doorgestuurd naar Budio.",
        }),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Issue aanmaken via server is mislukt.";
      setThread((current) =>
        appendLocalAssistantInfoMessage({
          thread: current,
          context,
          text: `Doorsturen lukte niet: ${message}`,
        }),
      );
      dispatchIssueFlow({ type: "mark_submit_failed", errorMessage: message });
    } finally {
      setCreatingIssue(false);
    }
  }, [activeIssueDraft, context, creatingIssue, issueFlowState.status]);

  const handleEditIssueDraft = React.useCallback(() => {
    if (!activeIssueDraft) return;
    setComposerValue(activeIssueDraft.sourceMessageText);
  }, [activeIssueDraft]);

  const handleCancelIssueDraft = React.useCallback(() => {
    if (!activeIssueDraft) return;
    dispatchIssueFlow({ type: "cancel" });
    latestStructuredIssueResponseRef.current = null;
    issueRequestAnchorRef.current = null;
    setComposerValue("");
  }, [activeIssueDraft]);

  const handleSubmit = React.useCallback(() => {
    if (creatingIssue) return;

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
  }, [
    composerValue,
    context,
    creatingIssue,
    requestAssistantReply,
  ]);

  return (
    <FinanceBottomSheetShell
      visible={visible}
      title="Hulpassistent"
      onClose={onClose}
      bodyStyle={styles.bodyShell}
      footerStyle={styles.footer}
      footer={
        <View style={styles.footerStack}>
          {shouldShowQuickActions ? (
            <HelpAssistantQuickActions
              actions={quickActions}
              onPressAction={handleQuickActionPress}
            />
          ) : null}
          <HelpAssistantComposer
            value={composerValue}
            onChangeText={setComposerValue}
            onSubmit={handleSubmit}
          />
        </View>
      }
      >
      {shouldShowIssueDraftPreview && activeIssueDraft ? (
        <View style={styles.issueDraftStickyWrap}>
          <HelpAssistantIssueDraftPreviewCard
            draft={activeIssueDraft}
            isSubmitting={creatingIssue}
            isSubmitted={issueFlowState.status === "submitted"}
            onCreateIssue={handleCreateIssueDraft}
            onEditFirst={handleEditIssueDraft}
            onCancel={handleCancelIssueDraft}
          />
        </View>
      ) : null}

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
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{greetingTitle}</Text>
          <Text style={styles.heroSubtitle}>
            Hoe kan ik je vandaag helpen met je financiële groei?
          </Text>
        </View>

        {thread.messages.length === 0 ? (
          <HelpAssistantEmptyThread />
        ) : (
          <View style={styles.threadWrap}>
            {thread.messages.map((message) => {
              const isAssistant = message.role === "assistant";
              const isLatestAssistant = message.id === latestAssistantMessageId;
              const isPending = message.status === "pending";
              const isReady = message.status === "ready";
              const isTypedCompleted = typedCompletedByMessageId[message.id] === true;
              const shouldRenderLiveAssistant =
                isAssistant &&
                isLatestAssistant &&
                (isPending || (isReady && !isTypedCompleted));

              return (
                <View
                  key={message.id}
                  style={[
                    styles.threadBubble,
                    message.role === "user"
                      ? styles.threadBubbleUser
                      : styles.threadBubbleAssistant,
                  ]}
                >
                  {message.role === "assistant" ? (
                    <View style={styles.assistantMessageWrap}>
                      <View style={styles.assistantHeaderRow}>
                        <View style={styles.assistantAvatar}>
                          <AppIcon
                            name="smart-toy"
                            size={14}
                            color={FinColors.textPrimary}
                            variant="outlined"
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
                              onTypingComplete={() => {
                                setTypedCompletedByMessageId((current) => ({
                                  ...current,
                                  [message.id]: true,
                                }));
                              }}
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
                      <Text style={styles.userLabel}>{userMessageLabel}</Text>
                      <HelpAssistantMarkdown
                        text={message.text}
                        tone="user"
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
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
    gap: 20,
    paddingBottom: 16,
  },
  issueDraftStickyWrap: {
    marginBottom: 12,
  },
  hero: {
    gap: 8,
    paddingTop: 2,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
    color: FinColors.textPrimary,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    color: FinColors.textMuted,
  },
  threadWrap: {
    gap: 14,
  },
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
  userMessageWrap: {
    gap: 6,
  },
  userLabel: {
    alignSelf: "flex-end",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    letterSpacing: 0.4,
    color: FinColors.textMuted,
  },
  assistantLiveResponse: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
  footer: {
    marginTop: 14,
  },
  footerStack: {
    gap: 12,
  },
});
