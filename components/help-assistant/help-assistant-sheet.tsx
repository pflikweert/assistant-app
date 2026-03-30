import { useSession } from "@/app/_layout";
import { BudioAssistantEmptyState } from "@/components/help-assistant/budio-assistant-empty-state";
import {
  HELP_ASSISTANT_COMPOSER_DOCK_HEIGHT,
  HelpAssistantComposerDock,
  type HelpAssistantComposerHandle,
} from "@/components/help-assistant/help-assistant-composer-dock";
import { HelpAssistantLiveStatus } from "@/components/help-assistant/help-assistant-live-status";
import { HelpAssistantIssueDraftPreviewCard } from "@/components/help-assistant/help-assistant-issue-draft-preview";
import { HelpAssistantThreadMessage } from "@/components/help-assistant/help-assistant-thread-message";
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
  type HelpAssistantActiveFlowDescriptor,
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
import React from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";

type HelpAssistantSheetProps = {
  visible: boolean;
  context: HelpAssistantContext;
  onClose: () => void;
};

const STICKY_MESSAGE_TOP_OFFSET = 8;

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
  const [sessionActiveFlow, setSessionActiveFlow] =
    React.useState<HelpAssistantActiveFlowDescriptor | null>(null);
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
    setSessionActiveFlow(null);
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
        : sessionActiveFlow;
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
        setSessionActiveFlow(reply.activeFlow || null);
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
    [context, sessionActiveFlow, sessionFinancialContext],
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
      headerAccessory={<HelpAssistantLiveStatus active={visible} />}
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
                  const isLatestAssistant = message.id === latestAssistantMessageId;
                  const isTypedCompleted = typedCompletedByMessageId[message.id] === true;

                  return (
                    <HelpAssistantThreadMessage
                      key={message.id}
                      message={message}
                      visible={visible}
                      isLatestAssistant={isLatestAssistant}
                      liveTypingMessageId={liveTypingMessageId}
                      typedCompleted={isTypedCompleted}
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
                      onTypingComplete={(messageId) => {
                        setTypedCompletedByMessageId((current) => ({
                          ...current,
                          [messageId]: true,
                        }));
                        setLiveTypingMessageId((current) =>
                          current === messageId ? null : current,
                        );
                        setStickyMessageAnchorId((current) =>
                          current === messageId ? null : current,
                        );
                      }}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        </ScrollView>

        <HelpAssistantComposerDock
          composerRef={composerRef}
          value={composerValue}
          onChangeText={setComposerValue}
          onSubmit={handleSubmit}
        />
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
  scroll: {
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  scrollContent: {
    flexGrow: 1,
    gap: 20,
    paddingBottom: HELP_ASSISTANT_COMPOSER_DOCK_HEIGHT + 28,
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
});
