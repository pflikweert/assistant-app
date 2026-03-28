import { useSession } from "@/app/_layout";
import { BudioAssistantEmptyState } from "@/components/help-assistant/budio-assistant-empty-state";
import {
  HelpAssistantComposer,
  type HelpAssistantComposerHandle,
} from "@/components/help-assistant/help-assistant-composer";
import { AiAssistantResponse } from "@/components/help-assistant/ai-assistant-response";
import { HelpAssistantIssueDraftPreviewCard } from "@/components/help-assistant/help-assistant-issue-draft-preview";
import { HelpAssistantMarkdown } from "@/components/help-assistant/help-assistant-markdown";
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
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

type HelpAssistantSheetProps = {
  visible: boolean;
  context: HelpAssistantContext;
  onClose: () => void;
};

const STICKY_MESSAGE_TOP_OFFSET = 8;
const COMPOSER_DOCK_HEIGHT = 110;

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
  const [liveTypingMessageId, setLiveTypingMessageId] = React.useState<string | null>(null);
  const [stickyMessageAnchorId, setStickyMessageAnchorId] =
    React.useState<string | null>(null);
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
  const composerRef = React.useRef<HelpAssistantComposerHandle>(null);
  const scrollRef = React.useRef<ScrollView>(null);
  const lastAutoScrollCursorRef = React.useRef<string | null>(null);
  const assistantStatusByIdRef = React.useRef<Record<string, string>>({});
  const messageLayoutYByIdRef = React.useRef<Record<string, number>>({});
  const [historyScrollBootstrapping, setHistoryScrollBootstrapping] =
    React.useState(false);
  const [scrollBehaviorMode, setScrollBehaviorMode] = React.useState<"auto" | "smooth">(
    "auto",
  );
  const livePulseValue = React.useRef(new Animated.Value(1)).current;
  const quickActions = React.useMemo(
    () => listHelpAssistantQuickActions(context),
    [context],
  );
  const latestMessageCursor = React.useMemo(() => {
    const message = thread.messages[thread.messages.length - 1];
    if (!message) return "0";
    return `${thread.messages.length}:${message.id}:${message.status}:${message.text.length}`;
  }, [thread.messages]);
  const latestAssistantMessage = React.useMemo(
    () =>
      [...thread.messages]
        .reverse()
        .find((message) => message.role === "assistant") ?? null,
    [thread.messages],
  );
  const latestAssistantMessageId = latestAssistantMessage?.id ?? null;
  const isLatestAssistantTyping =
    latestAssistantMessage?.id === liveTypingMessageId &&
    latestAssistantMessage?.status === "ready" &&
    typedCompletedByMessageId[latestAssistantMessage.id] !== true;
  const shouldLockScrollToStickyTop = Boolean(
    visible && stickyMessageAnchorId && isLatestAssistantTyping,
  );
  const webScrollBehaviorStyle = React.useMemo(
    () =>
      Platform.OS === "web"
        ? ({
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollBehavior: scrollBehaviorMode,
          } as any)
        : null,
    [scrollBehaviorMode],
  );
  const liveStatusDotAnimatedStyle = React.useMemo(
    () => ({
      opacity: livePulseValue.interpolate({
        inputRange: [0.75, 1],
        outputRange: [0.62, 1],
      }),
      transform: [
        {
          scale: livePulseValue.interpolate({
            inputRange: [0.75, 1],
            outputRange: [0.88, 1.06],
          }),
        },
      ],
    }),
    [livePulseValue],
  );
  const userFirstName = React.useMemo(
    () => resolveHelpAssistantFirstName(user),
    [user],
  );
  const greetingTitle = userFirstName ? `Hoi ${userFirstName},` : "Hoi,";
  const activeIssueDraft =
    issueFlowState.activeDraft && issueFlowState.status !== "idle"
      ? issueFlowState.activeDraft
      : null;
  const shouldShowIssueDraftPreview = Boolean(activeIssueDraft);
  const [keepEmptyStateMounted, setKeepEmptyStateMounted] = React.useState(
    () => visible && thread.messages.length === 0,
  );

  const scrollToLatestMessage = React.useCallback(
    ({ smooth }: { smooth: boolean }) => {
      if (Platform.OS === "web") {
        setScrollBehaviorMode(smooth ? "smooth" : "auto");
      }
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({
          animated: Platform.OS === "web" ? false : smooth,
        });
      });
    },
    [],
  );

  const scrollMessageToTopAnchor = React.useCallback((messageId: string) => {
    if (Platform.OS === "web") {
      setScrollBehaviorMode("auto");
    }
    const y = messageLayoutYByIdRef.current[messageId];
    if (typeof y !== "number") return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, y - STICKY_MESSAGE_TOP_OFFSET),
        animated: false,
      });
    });
  }, []);

  React.useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulseValue, {
          toValue: 0.75,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(livePulseValue, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => {
      pulseLoop.stop();
    };
  }, [livePulseValue]);

  React.useEffect(() => {
    if (!visible) return;
    const autofocusTimer = setTimeout(() => {
      composerRef.current?.focus();
    }, 110);
    return () => {
      clearTimeout(autofocusTimer);
    };
  }, [visible]);

  React.useEffect(() => {
    if (!visible) {
      setHistoryScrollBootstrapping(false);
      if (Platform.OS === "web") {
        setScrollBehaviorMode("auto");
      }
      return;
    }

    setHistoryScrollBootstrapping(true);
    scrollToLatestMessage({ smooth: false });
    const releaseBootstrapTimer = setTimeout(() => {
      setHistoryScrollBootstrapping(false);
    }, 220);
    return () => {
      clearTimeout(releaseBootstrapTimer);
    };
  }, [scrollToLatestMessage, visible]);

  React.useEffect(() => {
    if (!visible) return;
    if (!latestAssistantMessage) return;

    const knownMessageIds = new Set(thread.messages.map((message) => message.id));
    Object.keys(assistantStatusByIdRef.current).forEach((messageId) => {
      if (!knownMessageIds.has(messageId)) {
        delete assistantStatusByIdRef.current[messageId];
      }
    });

    const previousStatus = assistantStatusByIdRef.current[latestAssistantMessage.id];
    assistantStatusByIdRef.current[latestAssistantMessage.id] =
      latestAssistantMessage.status;

    if (latestAssistantMessage.status === "ready" && previousStatus === "pending") {
      setLiveTypingMessageId(latestAssistantMessage.id);
      setStickyMessageAnchorId(latestAssistantMessage.id);
      scrollMessageToTopAnchor(latestAssistantMessage.id);
    }
  }, [latestAssistantMessage, scrollMessageToTopAnchor, thread.messages, visible]);

  React.useEffect(() => {
    if (!visible) return;
    if (lastAutoScrollCursorRef.current === latestMessageCursor) return;
    lastAutoScrollCursorRef.current = latestMessageCursor;

    if (shouldLockScrollToStickyTop && stickyMessageAnchorId) {
      scrollMessageToTopAnchor(stickyMessageAnchorId);
      return;
    }
    scrollToLatestMessage({ smooth: !historyScrollBootstrapping });
  }, [
    historyScrollBootstrapping,
    latestMessageCursor,
    scrollMessageToTopAnchor,
    scrollToLatestMessage,
    shouldLockScrollToStickyTop,
    stickyMessageAnchorId,
    visible,
  ]);

  React.useEffect(() => {
    if (!visible) {
      setKeepEmptyStateMounted(false);
      return;
    }

    if (thread.messages.length === 0) {
      setKeepEmptyStateMounted(true);
    }
  }, [thread.messages.length, visible]);

  React.useEffect(() => {
    if (visible) return;
    setSessionFinancialContext(null);
    setTypedCompletedByMessageId({});
    setLiveTypingMessageId(null);
    setStickyMessageAnchorId(null);
    setHistoryScrollBootstrapping(false);
    if (Platform.OS === "web") {
      setScrollBehaviorMode("auto");
    }
    setCreatingIssue(false);
    lastAutoScrollCursorRef.current = null;
    assistantStatusByIdRef.current = {};
    messageLayoutYByIdRef.current = {};
    latestStructuredIssueResponseRef.current = null;
    issueRequestAnchorRef.current = null;
    dispatchIssueFlow({ type: "reset" });
  }, [visible]);

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

  const requestAssistantReply = React.useCallback(
    async (placeholderId: string, threadSnapshot: HelpAssistantThreadState) => {
      const latestUserMessage = [...threadSnapshot.messages]
        .reverse()
        .find((message) => message.role === "user");
      const requestAnchorMessageId = latestUserMessage?.id || null;
      issueRequestAnchorRef.current = requestAnchorMessageId;
      const hasActiveIssueFlow =
        issueFlowStateRef.current.status === "collecting" ||
        issueFlowStateRef.current.status === "ready_to_review" ||
        issueFlowStateRef.current.status === "submitting";
      const activeFlowDescriptor = hasActiveIssueFlow
        ? {
            route: "issue_intake" as const,
            mode: "issue_intake" as const,
            status: issueFlowStateRef.current.status,
            anchorMessageId: issueFlowStateRef.current.anchorMessageId,
            reason: "issue_review_banner_active",
          }
        : null;
      const shouldUseFinancialSessionContext = Boolean(
        latestUserMessage && isFinancialAdviceQuestion(latestUserMessage.text),
      );

      try {
        const reply = await requestHelpAssistantReply({
          context,
          thread: threadSnapshot,
          activeFlow: activeFlowDescriptor,
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

  const handleEmptyStateExitComplete = React.useCallback(() => {
    setKeepEmptyStateMounted(false);
  }, []);

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
      title="Budio Assistent"
      headerAccessory={
        <View style={styles.liveStatusWrap}>
          <View style={styles.liveStatusAvatar}>
            <AppIcon
              name="smart-toy"
              size={13}
              color={FinColors.textPrimary}
              variant="outlined"
            />
          </View>
          <View style={styles.livePill}>
            <Animated.View
              style={[styles.liveDot, liveStatusDotAnimatedStyle]}
            />
            <Text style={styles.livePillLabel}>Live</Text>
          </View>
        </View>
      }
      onClose={onClose}
      presentation="fullscreen"
      bodyStyle={styles.bodyShell}
    >
      <View style={styles.chatViewport}>
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
          style={[styles.scroll, webScrollBehaviorStyle]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            if (!visible) return;
            if (shouldLockScrollToStickyTop && stickyMessageAnchorId) {
              scrollMessageToTopAnchor(stickyMessageAnchorId);
              return;
            }
            scrollToLatestMessage({ smooth: !historyScrollBootstrapping });
          }}
        >
          <View style={styles.stage}>
            {visible && (thread.messages.length === 0 || keepEmptyStateMounted) ? (
              <View
                style={[
                  styles.emptyStateWrap,
                  thread.messages.length > 0 && styles.emptyStateOverlay,
                  thread.messages.length === 0
                    ? styles.pointerEventsAuto
                    : styles.pointerEventsNone,
                ]}
              >
                <BudioAssistantEmptyState
                  visible={thread.messages.length === 0}
                  actions={quickActions}
                  onPressAction={handleQuickActionPress}
                  onExitComplete={handleEmptyStateExitComplete}
                  assistantLabel=""
                  greetingTitle={greetingTitle}
                  intensity={0.66}
                />
              </View>
            ) : null}

            {thread.messages.length > 0 ? (
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
                    message.id === liveTypingMessageId &&
                    isReady &&
                    !isTypedCompleted;

                  return (
                    <View
                      key={message.id}
                      onLayout={(event) => {
                        messageLayoutYByIdRef.current[message.id] =
                          event.nativeEvent.layout.y;
                        if (
                          shouldLockScrollToStickyTop &&
                          message.id === stickyMessageAnchorId
                        ) {
                          scrollMessageToTopAnchor(message.id);
                        }
                      }}
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
                                    setLiveTypingMessageId((current) =>
                                      current === message.id ? null : current,
                                    );
                                    setStickyMessageAnchorId((current) =>
                                      current === message.id ? null : current,
                                    );
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
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.composerDock} pointerEvents="box-none">
          <View style={styles.composerDockGlass} />
          <View style={styles.composerContentWrap}>
            <HelpAssistantComposer
              ref={composerRef}
              value={composerValue}
              onChangeText={setComposerValue}
              onSubmit={handleSubmit}
            />
          </View>
        </View>
      </View>
    </FinanceBottomSheetShell>
  );
}

const styles = StyleSheet.create({
  bodyShell: {
    marginTop: 0,
    minHeight: 0,
    position: "relative",
  },
  chatViewport: {
    flex: 1,
    minHeight: 0,
  },
  liveStatusWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveStatusAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: FinColors.yellow,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(17,17,17,0.05)",
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: FinColors.green,
  },
  livePillLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: FinColors.textSecondary,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  scrollContent: {
    flexGrow: 1,
    gap: 20,
    paddingBottom: COMPOSER_DOCK_HEIGHT + 28,
  },
  issueDraftStickyWrap: {
    marginBottom: 12,
    zIndex: 2,
  },
  stage: {
    position: "relative",
    flexGrow: 1,
  },
  threadWrap: {
    gap: 14,
    paddingTop: 2,
  },
  emptyStateWrap: {
    flexGrow: 1,
    justifyContent: "center",
  },
  pointerEventsAuto: {
    pointerEvents: "auto",
  },
  pointerEventsNone: {
    pointerEvents: "none",
  },
  emptyStateOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 1,
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
    gap: 0,
  },
  assistantLiveResponse: {
    marginHorizontal: 0,
    marginVertical: 0,
  },
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
