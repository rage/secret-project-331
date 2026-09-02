"use client"

import { css, cx } from "@emotion/css"
import React, { useCallback, useEffect, useMemo, useRef } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type {
  ChatbotConversationMessage,
  ChatbotConversationMessageCitation,
  ClientToolAnswer,
  ClientToolName,
} from "@/generated/course-material-api/types.generated"
import SendIcon from "@/imgs/send.svg"
import StopIcon from "@/imgs/stop.svg"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import { baseTheme } from "@/shared-module/common/styles"
import { LoadingRegion } from "@/shared-module/components"

import { CHATBOX_HEIGHT_PX } from "../Chatbot/ChatbotDialog"
import ChatbotDisclaimer from "./ChatbotDisclaimer"
import { hasStreamedAssistantContent } from "./chatbotReducer"
import ChatbotStatusRow from "./ChatbotStatusRow"
import type { ClosedClientToolAnswer } from "./clientToolRegistry"
import { CLIENT_TOOL_REGISTRY } from "./clientToolRegistry"
import ErrorDisplay from "./ErrorDisplay"
import type { ChatbotStateAndData } from "./hooks/useChatbotStateAndData"
import MessageBubble from "./MessageBubble"
import type { MessageClassification } from "./messageClassification"
import {
  classifyMessage,
  openClientToolCallsFromClassified,
  clientAnswerByToolCallIdFromClassified,
} from "./messageClassification"
import SuggestedMessageChip from "./SuggestedMessageChip"
import ToolCallReasoningBubble from "./ToolCallReasoningBubble"

export interface ChatbotConversationMessageWithStatus {
  message: ChatbotConversationMessage
  finished: boolean
  optimistic: boolean
}

interface ClassifiedMessage extends ChatbotConversationMessageWithStatus {
  classification: MessageClassification
}

/// A client tool call with the state that decides how it renders, resolved for the registry
/// entry's bubble to spread straight into `ClientToolBubbleProps`.
interface ClientToolCallRow {
  toolCallId: string
  toolName: string
  call: unknown
  isOpen: boolean
  closedAnswer: ClosedClientToolAnswer
  executionPayload: unknown
}

/// One row of the conversation list, with the tool call and reasoning `items` that precede its
/// message, after the previous text message.
///
/// An `items` row is a trailing run of those that no message has arrived for yet; it borrows the
/// first item's id as its `messageId`.
type ConversationRowData =
  | {
      kind: "clientToolCall"
      messageId: string
      items: ClassifiedMessage[] | null
      call: ClientToolCallRow
    }
  | {
      kind: "text"
      messageId: string
      items: ClassifiedMessage[] | null
      text: string
      isFromChatbot: boolean
      isComplete: boolean
    }
  | { kind: "items"; messageId: string; items: ClassifiedMessage[] }

/// Turns a run of messages into the rows the conversation renders, resolving each client tool call
/// through `resolveClientToolCall` on the way. A client tool call is one the learner has to read
/// and possibly answer, so it gets a row of its own instead of joining the collapsed tool status
/// items.
const conversationRows = (
  messages: ClassifiedMessage[],
  resolveClientToolCall: (toolCallId: string, toolName: string, call: unknown) => ClientToolCallRow,
): ConversationRowData[] => {
  const rows: ConversationRowData[] = []

  let earliestItemIndex: number | null = null
  const takeItemsBefore = (index: number): ClassifiedMessage[] | null => {
    if (earliestItemIndex === null) {
      return null
    }
    const items = messages.slice(earliestItemIndex, index)
    earliestItemIndex = null
    return items
  }

  messages.forEach((m, idx) => {
    const classification = m.classification
    if (classification.kind === "clientToolCall") {
      rows.push({
        // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
        kind: "clientToolCall",
        messageId: m.message.id,
        items: takeItemsBefore(idx),
        call: resolveClientToolCall(
          classification.toolCallId,
          classification.toolName,
          classification.call,
        ),
      })
      return
    }
    if (classification.kind === "userText" || classification.kind === "assistantText") {
      rows.push({
        // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
        kind: "text",
        messageId: m.message.id,
        items: takeItemsBefore(idx),
        text: classification.text,
        isFromChatbot: classification.kind === "assistantText",
        isComplete: classification.isComplete,
      })
      return
    }
    if (
      (classification.kind === "toolCall" || classification.kind === "reasoning") &&
      earliestItemIndex === null
    ) {
      earliestItemIndex = idx
    }
  })

  const trailingItems = takeItemsBefore(messages.length)
  if (trailingItems !== null && trailingItems[0] !== undefined) {
    // oxlint-disable-next-line i18next/no-literal-string -- discriminant tag, never rendered
    rows.push({ kind: "items", messageId: trailingItems[0].message.id, items: trailingItems })
  }

  return rows
}

// Full-width flex column so the bubble can align itself to the start or end of the row.
const messageListItemStyle = css`
  display: flex;
  flex-direction: column;
`

/// How close to the bottom counts as following the answer. Covers a partly-scrolled last line.
const FOLLOW_OUTPUT_THRESHOLD_PX = 40

const errorWrapperStyle = css`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
`

const disclaimerAgreeButtonStyle = css`
  margin-top: 6px;
`

const conversationWrapperStyle = css`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const messageListStyle = css`
  flex-grow: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 1rem;
  margin: 0;
  list-style: none;
`

const suggestionsRowStyle = css`
  display: flex;
  flex-flow: column nowrap;
  margin-top: auto;
  margin-left: 2rem;
`

const disclaimerFooterStyle = css`
  margin: 0.5rem 1rem 0.75rem;
  font-size: 0.8rem;
  color: ${baseTheme.colors.gray[500]};
  text-align: center;
`

// The shell carries the border and the focus ring for the whole composer, so the field inside it
// can render borderless and the button reads as docked into the same surface.
const composerShellStyle = css`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 1rem;
  padding: 0.25rem 0.25rem 0.25rem 0.5rem;
  /* gray[400] is the palest step still >= 3:1 against the field background (WCAG 1.4.11);
     gray[300] measures 2.76:1. Matches the border the shared field picks for the same reason. */
  border: 1.5px solid ${baseTheme.colors.gray[400]};
  border-radius: 14px;
  background-color: ${baseTheme.colors.clear[50]};
  box-shadow: 0 1px 2px ${baseTheme.colors.gray[700]}14;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  /* Mirrors the tokens shared fields focus with (--field-border-color-focus, --focus-ring-color);
     restated here because packages/common has no token export the composer can import. */
  &:focus-within {
    border-color: ${baseTheme.colors.green[500]};
    box-shadow: 0 0 0 4px ${baseTheme.colors.green[600]}99;
  }
`

const composerFieldStyle = css`
  flex-grow: 1;
  min-width: 0;
  margin-bottom: 0;

  /* Reaches into TextAreaField's own label textarea rules, which it renders and styles at the
     same specificity; this wins only because cx puts the consumer class last. */
  label textarea {
    padding: 0.6rem 0.25rem 0.4rem 0.4rem;
    border: none;
    background: transparent;
    resize: none;
  }

  /* The shell already shows focus for the whole composer. */
  label textarea:focus,
  label textarea:focus-visible {
    box-shadow: none;
  }
`

const composerButtonStyle = css`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: none;
  border-radius: 50%;
  color: ${baseTheme.colors.primary[100]};
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;

  svg {
    width: 18px;
    height: 18px;
  }

  &:disabled {
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${baseTheme.colors.green[600]};
    outline-offset: 2px;
  }
`

const sendButtonStyle = css`
  background-color: ${baseTheme.colors.green[600]};

  /* The glyph points right; the rotation aims it up-right, so it applies to the send state only. */
  svg {
    position: relative;
    left: -2px;
    transform: rotate(45deg);
  }

  &:disabled {
    background-color: ${baseTheme.colors.clear[500]};
    color: ${baseTheme.colors.gray[300]};
  }

  &:hover:not(:disabled) {
    background-color: ${baseTheme.colors.green[700]};
  }
`

const stopButtonStyle = css`
  background-color: ${baseTheme.colors.red[600]};

  &:hover:not(:disabled) {
    background-color: ${baseTheme.colors.red[700]};
  }
`

// Hoisted because emotion re-serializes and re-hashes the result on every cx call.
const sendButtonClass = cx(composerButtonStyle, sendButtonStyle)
const stopButtonClass = cx(composerButtonStyle, stopButtonStyle)

interface ConversationRowProps {
  row: ConversationRowData
  isTurnInFlight: boolean
  citations: Map<string, ChatbotConversationMessageCitation[]>
  onAnswer: (toolCallId: string, toolName: ClientToolName, answer: ClientToolAnswer) => void
}

/** One row of the conversation: a client tool call, or a user/assistant message, each with its own
 * preceding tool-call and reasoning items, if any. */
const ConversationRow: React.FC<ConversationRowProps> = ({
  row,
  isTurnInFlight,
  citations,
  onAnswer,
}) => {
  const { t } = useTranslation()

  if (row.kind === "items") {
    return (
      <li className={messageListItemStyle}>
        <ToolCallReasoningBubble messages={row.items} />
      </li>
    )
  }

  if (row.kind === "clientToolCall") {
    const entry = CLIENT_TOOL_REGISTRY[row.call.toolName]
    if (!entry) {
      // Classification only produces this kind once a registry entry has validated the call, so
      // this is unreachable outside a registry/classification drift.
      return null
    }
    return (
      <li className={messageListItemStyle} aria-label={t("question-from-the-chatbot")}>
        {row.items !== null && <ToolCallReasoningBubble messages={row.items} />}
        {entry.renderBubble({
          toolCallId: row.call.toolCallId,
          call: row.call.call,
          isOpen: row.call.isOpen,
          // A stream is still writing to the conversation, so the call this answers may not be
          // stored yet and answering it would be refused.
          isTurnInFlight,
          closedAnswer: row.call.closedAnswer,
          executionPayload: row.call.executionPayload,
          onAnswer,
        })}
      </li>
    )
  }

  return (
    <li
      className={messageListItemStyle}
      // role=generic (the bubble div) can't be named, so the label lives here (aria-prohibited-attr).
      aria-label={row.isFromChatbot ? t("message-from-chatbot") : t("message-from-you")}
    >
      {row.items !== null && <ToolCallReasoningBubble messages={row.items} />}
      <MessageBubble
        message={row.text}
        citations={citations.get(row.messageId)}
        isFromChatbot={row.isFromChatbot}
        isPending={!row.isComplete && isTurnInFlight}
      />
    </li>
  )
}

interface ChatbotConversationViewProps {
  rows: ConversationRowData[]
  citations: Map<string, ChatbotConversationMessageCitation[]>
  onAnswer: (toolCallId: string, toolName: ClientToolName, answer: ClientToolAnswer) => void
  isTurnInFlight: boolean
  hasStreamedAssistantContent: boolean
  suggestedMessages: { id: string; message: string }[]
  isSuggestionsLoading: boolean
  onPickSuggestion: (message: string) => void
  scrollContainerRef: React.RefObject<HTMLUListElement | null>
  onScroll: () => void
  error: unknown
  newMessage: string
  setNewMessage: (message: string) => void
  onSubmit: () => void
  onStop: () => void
  canSubmit: boolean
  composerRef: React.RefObject<HTMLTextAreaElement | null>
  onAutoResized: () => void
}

/** The conversation history, composer and suggestion chips, once a conversation exists to show. */
const ChatbotConversationView: React.FC<ChatbotConversationViewProps> = ({
  rows,
  citations,
  onAnswer,
  isTurnInFlight,
  hasStreamedAssistantContent: hasStreamedContent,
  suggestedMessages,
  isSuggestionsLoading,
  onPickSuggestion,
  scrollContainerRef,
  onScroll,
  error,
  newMessage,
  setNewMessage,
  onSubmit,
  onStop,
  canSubmit,
  composerRef,
  onAutoResized,
}) => {
  const { t } = useTranslation()

  const isQuestionWaiting = rows.some((row) => row.kind === "clientToolCall" && row.call.isOpen)

  return (
    <div className={conversationWrapperStyle}>
      <ul
        className={messageListStyle}
        ref={scrollContainerRef}
        onScroll={onScroll}
        aria-busy={isTurnInFlight}
      >
        {rows.map((row) => (
          <ConversationRow
            key={row.messageId}
            row={row}
            isTurnInFlight={isTurnInFlight}
            citations={citations}
            onAnswer={onAnswer}
          />
        ))}
        {/* hasStreamedContent ignores the optimistic user message, so this row stays up from
          send until the chatbot's own content starts streaming. No text yet: Azure hasn't said
          more than "turn started" at this point, so claiming "Thinking" here would be a guess. */}
        {isTurnInFlight && !hasStreamedContent && (
          <li className={messageListItemStyle}>
            <ChatbotStatusRow />
          </li>
        )}
        <li className={suggestionsRowStyle}>
          {/* The suggestions were fetched for an earlier state of the conversation, so they can
            outlive the moment they fitted; taking one while a question waits abandons it. */}
          {!isTurnInFlight &&
            !isQuestionWaiting &&
            suggestedMessages.map((m) => (
              <SuggestedMessageChip
                key={m.id}
                isLoading={isSuggestionsLoading}
                message={m.message}
                handleClick={() => onPickSuggestion(m.message)}
              />
            ))}
        </li>
      </ul>
      {error !== null && error !== undefined ? <ErrorDisplay error={error} /> : null}
      <div className={composerShellStyle}>
        <TextAreaField
          ref={composerRef}
          className={composerFieldStyle}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              if (canSubmit) {
                onSubmit()
              }
            }
          }}
          // An empty composer is one line the send button sits level with; autoResize grows it.
          rows={1}
          autoResize={true}
          onAutoResized={onAutoResized}
          autoResizeMaxHeightPx={CHATBOX_HEIGHT_PX * 0.4}
          placeholder={t("label-message")}
        />
        {/* One button across both states, so focus and tab order survive a turn starting or
          ending. */}
        <button
          className={isTurnInFlight ? stopButtonClass : sendButtonClass}
          disabled={!isTurnInFlight && !canSubmit}
          aria-label={isTurnInFlight ? t("stop-generating") : t("send")}
          onClick={() => {
            if (isTurnInFlight) {
              onStop()
            } else {
              onSubmit()
            }
          }}
        >
          {isTurnInFlight ? <StopIcon /> : <SendIcon />}
        </button>
      </div>
      <div className={disclaimerFooterStyle}>{t("warning-chatbots-can-make-mistakes")}</div>
    </div>
  )
}

const ChatbotChatBody: React.FC<ChatbotStateAndData> = ({
  currentConversationInfo,
  newConversationMutation,
  newMessage,
  setNewMessage,
  error,
  messageState,
  chatbotMessageAnnouncement,
  newMessageMutation,
  toolResponseMutation,
  isTurnInFlight,
  stopTurn,
}) => {
  const scrollContainerRef = useRef<HTMLUListElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useTranslation()

  const citations = useMemo(() => {
    const citationsMap = new Map<string, ChatbotConversationMessageCitation[]>()

    if (!currentConversationInfo.data?.hide_citations) {
      currentConversationInfo.data?.current_conversation_message_citations?.forEach((cit) => {
        const id = cit.conversation_message_id
        const existing = citationsMap.get(id)
        if (existing === undefined) {
          citationsMap.set(id, [cit])
        } else {
          citationsMap.set(id, existing.concat(cit))
        }
      })
    }

    return citationsMap
  }, [
    currentConversationInfo.data?.current_conversation_message_citations,
    currentConversationInfo.data?.hide_citations,
  ])

  // Classified once per source array, and the same classification serves both the rows below and
  // the question fold, so a streamed token only re-classifies the short streamed array; the
  // fetched history is classified again only once it actually changes.
  const classifiedFetched = useMemo(
    (): ClassifiedMessage[] =>
      (currentConversationInfo.data?.current_conversation_messages ?? []).map((message) => ({
        finished: true,
        message,
        optimistic: false,
        classification: classifyMessage(message),
      })),
    [currentConversationInfo.data?.current_conversation_messages],
  )

  const classifiedStreamed = useMemo(
    (): ClassifiedMessage[] =>
      messageState.messages.map((m) => ({ ...m, classification: classifyMessage(m.message) })),
    [messageState.messages],
  )

  const allClassifications = useMemo(
    () => classifiedFetched.concat(classifiedStreamed).map((m) => m.classification),
    [classifiedFetched, classifiedStreamed],
  )

  /**
   * The client tool calls the learner can still answer. The optimistic user message that aborts
   * one closes it here as well, before the abort itself comes back from the server.
   */
  const openToolCallIds = useMemo(
    () => new Set(openClientToolCallsFromClassified(allClassifications).map((c) => c.toolCallId)),
    [allClassifications],
  )

  const closedAnswerByToolCallId = useMemo(
    () => clientAnswerByToolCallIdFromClassified(allClassifications),
    [allClassifications],
  )

  const handleAnswer = useCallback(
    (toolCallId: string, toolName: ClientToolName, answer: ClientToolAnswer) => {
      // The choices go away with the answer, taking the focused button with them, and the message
      // field is where the learner carries on either way.
      composerRef.current?.focus()
      toolResponseMutation.mutate({ toolCallId, toolName, answer })
    },
    [toolResponseMutation],
  )

  const resolveClientToolCall = useCallback(
    (toolCallId: string, toolName: string, call: unknown): ClientToolCallRow => ({
      toolCallId,
      toolName,
      call,
      isOpen: openToolCallIds.has(toolCallId),
      closedAnswer: closedAnswerByToolCallId.has(toolCallId)
        ? { value: closedAnswerByToolCallId.get(toolCallId) }
        : undefined,
      executionPayload: messageState.executionPayloadByToolCallId[toolCallId],
    }),
    [openToolCallIds, closedAnswerByToolCallId, messageState.executionPayloadByToolCallId],
  )

  const rows = useMemo(
    () =>
      conversationRows(
        // A stored tool output has nothing to show; leaving it out also keeps it from joining the
        // tool status items of the row that follows it.
        classifiedFetched.filter(
          (m) => m.classification.kind !== "other" && m.classification.kind !== "toolOutput",
        ),
        resolveClientToolCall,
      ).concat(conversationRows(classifiedStreamed, resolveClientToolCall)),
    [classifiedFetched, classifiedStreamed, resolveClientToolCall],
  )

  // Starts armed so the first paint of a conversation lands on its newest message.
  const isFollowingRef = useRef(true)

  // Sampled while the learner scrolls, never after new output: by then it is in the DOM and the
  // distance reports its height rather than where the learner is.
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (container === null) {
      return
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    isFollowingRef.current = distanceFromBottom <= FOLLOW_OUTPUT_THRESHOLD_PX
  }, [])

  /**
   * Keeps the newest output in view, unless the learner has scrolled up to re-read something.
   * Re-arms `isFollowingRef` on its own, because scrolling the container fires `handleScroll`.
   */
  const scrollToBottomIfFollowing = useCallback(() => {
    const container = scrollContainerRef.current
    if (container !== null && isFollowingRef.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottomIfFollowing()
  }, [scrollToBottomIfFollowing, classifiedFetched, messageState.messages])

  const canSubmit = Boolean(newMessage && newMessage.trim().length > 0 && !isTurnInFlight)

  const handleSubmit = useCallback(() => {
    newMessageMutation.mutate(newMessage)
  }, [newMessageMutation, newMessage])

  const handlePickSuggestion = useCallback(
    (message: string) => {
      newMessageMutation.mutate(message)
    },
    [newMessageMutation],
  )

  return (
    <>
      {/* A live region has to already be mounted when its text changes, or the change is never
        announced, so this renders unconditionally as a sibling of every view state below rather
        than only inside one of them. */}
      <VisuallyHidden aria-live="polite" role="status">
        {chatbotMessageAnnouncement}
      </VisuallyHidden>
      {currentConversationInfo.isLoading ? (
        <LoadingRegion />
      ) : currentConversationInfo.isError ? (
        <div className={errorWrapperStyle}>
          <ErrorBanner
            error={currentConversationInfo.error}
            variant="readOnly"
            maxHeightVH={50}
            listMaxHeightVH={35}
          />
          <Button
            onClick={() => currentConversationInfo.refetch()}
            variant="secondary"
            size="small"
          >
            {t("try-again")}
          </Button>
        </div>
      ) : !currentConversationInfo.data?.current_conversation ? (
        <ChatbotDisclaimer
          agreeButton={
            <Button
              className={disclaimerAgreeButtonStyle}
              size="medium"
              variant="secondary"
              onClick={() => {
                newConversationMutation.mutate()
              }}
              disabled={newConversationMutation.isPending}
            >
              {t("button-text-agree")}
            </Button>
          }
        />
      ) : (
        <ChatbotConversationView
          rows={rows}
          citations={citations}
          onAnswer={handleAnswer}
          isTurnInFlight={isTurnInFlight}
          hasStreamedAssistantContent={hasStreamedAssistantContent(messageState.messages)}
          suggestedMessages={currentConversationInfo.data.suggested_messages ?? []}
          isSuggestionsLoading={currentConversationInfo.isRefetching}
          onPickSuggestion={handlePickSuggestion}
          scrollContainerRef={scrollContainerRef}
          onScroll={handleScroll}
          error={error}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSubmit={handleSubmit}
          onStop={stopTurn}
          canSubmit={canSubmit}
          composerRef={composerRef}
          onAutoResized={scrollToBottomIfFollowing}
        />
      )}
    </>
  )
}

export default React.memo(ChatbotChatBody)
