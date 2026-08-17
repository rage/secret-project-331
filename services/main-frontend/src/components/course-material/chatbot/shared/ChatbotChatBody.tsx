"use client"

import { css, cx } from "@emotion/css"
import { PaperAirplane, Stop } from "@vectopus/atlas-icons-react"
import React, { useCallback, useEffect, useMemo, useRef } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"

import type {
  ChatbotConversationMessage,
  ChatbotConversationMessageCitation,
} from "@/generated/course-material-api/types.generated"
import {
  zChatbotConversationMessageMessage,
  zChatbotConversationMessageReasoning,
  zChatbotConversationMessageToolCall,
} from "@/generated/course-material-api/zod.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

import { CHATBOX_HEIGHT_PX } from "../Chatbot/ChatbotDialog"
import ChatbotDisclaimer from "./ChatbotDisclaimer"
import ChatbotStatusRow from "./ChatbotStatusRow"
import ErrorDisplay from "./ErrorDisplay"
import type { ChatbotStateAndData } from "./hooks/useChatbotStateAndData"
import MessageBubble from "./MessageBubble"
import MultipleChoiceQuestionBubble from "./MultipleChoiceQuestionBubble"
import { openQuestions, questionOf } from "./multipleChoiceQuestions"
import SuggestedMessageChip from "./SuggestedMessageChip"
import ToolCallReasoningBubble from "./ToolCallReasoningBubble"

/// Map each assistant message with the tool call and reasoning items that are
/// associated with it (which appear before it in the conversation, after a text
/// message.) User messages and assistant messages with no tool calls etc are
/// mapped with null. The last tool calls etc. that are streamed and don't yet
/// have an assistant message are mapped with a null key and should be shown still.
/// A clarifying question is a tool call the learner has to read, so it gets a row of its own
/// instead of joining the collapsed tool status items.
const messageMapMaker = (
  messages: ChatbotConversationMessageWithStatus[],
): Map<
  ChatbotConversationMessageWithStatus | null,
  ChatbotConversationMessageWithStatus[] | null
> => {
  let messagesMap = new Map<
    ChatbotConversationMessageWithStatus | null,
    ChatbotConversationMessageWithStatus[] | null
  >()

  let earliestItemIndex: number | null = null
  messages.forEach((m, idx) => {
    const messageResult = zChatbotConversationMessageMessage.safeParse(m.message.message)
    let messageSuccess =
      messageResult.success &&
      (messageResult.data.message_role === "user" ||
        messageResult.data.message_role === "assistant")
    if (messageSuccess || questionOf(m.message) !== null) {
      if (earliestItemIndex !== null) {
        let toolReasoningItemsForThisMessage = messages.slice(earliestItemIndex, idx)
        messagesMap.set(m, toolReasoningItemsForThisMessage)
        earliestItemIndex = null
      } else {
        messagesMap.set(m, null)
      }
      return
    }
    const toolCallResult = zChatbotConversationMessageToolCall.safeParse(m.message.message)
    const reasoningResult = zChatbotConversationMessageReasoning.safeParse(m.message.message)
    if ((toolCallResult.success || reasoningResult.success) && earliestItemIndex === null) {
      earliestItemIndex = idx
    }
  })

  if (earliestItemIndex !== null) {
    messagesMap.set(null, messages.slice(earliestItemIndex))
  }

  return messagesMap
}

export interface ChatbotConversationMessageWithStatus {
  message: ChatbotConversationMessage
  finished: boolean
  optimistic: boolean
}

// Full-width flex column so the bubble can align itself to the start or end of the row.
const messageListItemStyle = css`
  display: flex;
  flex-direction: column;
`

/// How close to the bottom counts as following the answer. Covers a partly-scrolled last line.
const FOLLOW_OUTPUT_THRESHOLD_PX = 40

const composerButtonStyle = css`
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.3rem 0.6rem;
  transition: filter 0.2s;

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  &:hover {
    filter: brightness(0.9) contrast(1.1);
  }
`

// The rotation angles the paper airplane, so it must not reach the stop icon.
const sendButtonStyle = css`
  background-color: ${baseTheme.colors.green[200]};

  svg {
    position: relative;
    left: -2px;
    transform: rotate(45deg);
  }
`

const stopButtonStyle = css`
  background-color: ${baseTheme.colors.red[200]};
`

// Hoisted because emotion re-serializes and re-hashes the result on every cx call.
const sendButtonClass = cx(composerButtonStyle, sendButtonStyle)
const stopButtonClass = cx(composerButtonStyle, stopButtonStyle)

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

  const messagesMap = useMemo(() => {
    const messages: ChatbotConversationMessageWithStatus[] = [
      ...(currentConversationInfo.data?.current_conversation_messages
        ?.filter((m) => {
          const messageResult = zChatbotConversationMessageMessage.safeParse(m.message)
          let messageSuccess =
            messageResult.success &&
            (messageResult.data.message_role === "user" ||
              messageResult.data.message_role === "assistant")
          const toolCallResult = zChatbotConversationMessageToolCall.safeParse(m.message)
          const reasoningResult = zChatbotConversationMessageReasoning.safeParse(m.message)
          return messageSuccess || toolCallResult.success || reasoningResult.success
        })
        .map((m) => {
          return { finished: true, message: m, optimistic: false }
        }) ?? []),
    ]

    // map is ordered in the insertion order
    const orderedMessagesMap = messageMapMaker(messages)

    return orderedMessagesMap
  }, [currentConversationInfo.data?.current_conversation_messages])

  const messagesMap2 = useMemo(() => {
    return messageMapMaker(messageState.messages)
  }, [messageState.messages])

  /**
   * The questions the learner can still answer. A running stream's messages continue the fetched
   * ones, so the optimistic user message that aborts a question closes it here as well, before the
   * abort itself comes back from the server.
   */
  const openQuestionToolCallIds = useMemo(
    () =>
      new Set(
        openQuestions([
          ...(currentConversationInfo.data?.current_conversation_messages ?? []),
          ...messageState.messages.map((m) => m.message),
        ]).map((question) => question.toolCallId),
      ),
    [currentConversationInfo.data?.current_conversation_messages, messageState.messages],
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
  }, [scrollToBottomIfFollowing, messagesMap, messageState.messages])

  const canSubmit = useMemo(
    () => Boolean(newMessage && newMessage.trim().length > 0 && !isTurnInFlight),
    [newMessage, isTurnInFlight],
  )

  // A closure, not a component, so the live region below stays one DOM node across these branches:
  // a live region inserted with its text already inside is not announced.
  const renderBody = () => {
    if (currentConversationInfo.isLoading) {
      return <Spinner variant="medium" />
    }

    if (currentConversationInfo.isError) {
      return (
        <div
          className={css`
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            padding: 20px;
          `}
        >
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
      )
    }

    if (currentConversationInfo && !currentConversationInfo.data?.current_conversation) {
      return (
        <ChatbotDisclaimer
          agreeButton={
            <Button
              className={css`
                margin-top: 6px;
              `}
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
      )
    }

    return (
      <div
        className={css`
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        `}
      >
        <ul
          className={css`
            flex-grow: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            padding: 1rem;
            margin: 0;
            list-style: none;
          `}
          ref={scrollContainerRef}
          onScroll={handleScroll}
          aria-busy={isTurnInFlight}
        >
          {[...messagesMap.entries(), ...messagesMap2.entries()].map(([message, items]) => {
            if (message === null && items !== null && items[0] !== undefined) {
              const key = items[0].message.id
              return (
                <li key={key} className={messageListItemStyle}>
                  <ToolCallReasoningBubble messages={items} isTurnInFlight={isTurnInFlight} />
                </li>
              )
            }
            if (message === null) {
              return null
            }
            const question = questionOf(message.message)
            if (question !== null) {
              const isOpen = openQuestionToolCallIds.has(question.toolCallId)
              return (
                <li
                  key={`chatbot-question-${message.message.id}`}
                  className={messageListItemStyle}
                  aria-label={t("question-from-the-chatbot")}
                >
                  {items !== null && (
                    <ToolCallReasoningBubble messages={items} isTurnInFlight={isTurnInFlight} />
                  )}
                  <MultipleChoiceQuestionBubble
                    question={question}
                    isOpen={isOpen}
                    // A stream is still writing to the conversation, so the call this answers may not
                    // be stored yet and answering it would be refused.
                    isAnswering={isTurnInFlight}
                    onChoose={(choiceIndex) => {
                      // The choices go away with the answer, taking the focused button with them, and
                      // the message field is where the learner carries on either way.
                      composerRef.current?.focus()
                      toolResponseMutation.mutate({ toolCallId: question.toolCallId, choiceIndex })
                    }}
                  />
                </li>
              )
            }
            let m = zChatbotConversationMessageMessage.safeParse(message.message.message)
            if (m.success) {
              return (
                <li
                  key={`chatbot-status-message-${message.message.id}`}
                  className={messageListItemStyle}
                  // role=generic (the bubble div) can't be named, so the label lives here (aria-prohibited-attr).
                  aria-label={
                    m.data.message_role === "assistant"
                      ? t("message-from-chatbot")
                      : t("message-from-you")
                  }
                >
                  {items !== null && (
                    <ToolCallReasoningBubble messages={items} isTurnInFlight={isTurnInFlight} />
                  )}
                  <MessageBubble
                    message={m.data.text ?? ""}
                    citations={citations.get(message.message.id)}
                    isFromChatbot={m.data.message_role === "assistant"}
                    isPending={!m.data.message_is_complete && isTurnInFlight}
                  />
                </li>
              )
            }
            return null
          })}
          {/* From the first streamed item on, the streamed bubbles carry the status instead. */}
          {isTurnInFlight && messageState.messages.length === 0 && (
            <ChatbotStatusRow asListItem={true} text={t("chatbot-status-thinking")} />
          )}
          <li
            className={css`
              display: flex;
              flex-flow: column nowrap;
              margin-top: auto;
              margin-left: 2rem;
            `}
          >
            {/* The suggestions were fetched for an earlier state of the conversation, so they can
              outlive the moment they fitted; taking one while a question waits abandons it. */}
            {!isTurnInFlight &&
              openQuestionToolCallIds.size === 0 &&
              currentConversationInfo.data.suggested_messages?.map((m) => (
                <SuggestedMessageChip
                  key={m.id}
                  isLoading={
                    isTurnInFlight ||
                    currentConversationInfo.isLoading ||
                    currentConversationInfo.isRefetching
                  }
                  message={m.message}
                  handleClick={() => {
                    if (!isTurnInFlight) {
                      newMessageMutation.mutate(m.message)
                    }
                  }}
                />
              ))}
          </li>
        </ul>
        {error !== null && error !== undefined ? <ErrorDisplay error={error} /> : null}
        <div
          className={css`
            display: flex;
            gap: 10px;
            align-items: center;
            margin: 0 1rem;
          `}
        >
          <div
            className={css`
              flex-grow: 1;
            `}
          >
            <TextAreaField
              ref={composerRef}
              className={css`
                width: 100%;
                padding: 0.5rem;
                resize: none;

                &:focus {
                  outline: 1px solid ${baseTheme.colors.gray[300]};
                }
              `}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (canSubmit) {
                    newMessageMutation.mutate(newMessage)
                  }
                }
              }}
              // oxlint-disable-next-line i18next/no-literal-string
              resize={"none"}
              autoResize={true}
              onAutoResized={scrollToBottomIfFollowing}
              autoResizeMaxHeightPx={CHATBOX_HEIGHT_PX * 0.4}
              placeholder={t("label-message")}
            />
          </div>
          <div>
            {/* One button across both states, so focus and tab order survive a turn starting or
              ending. */}
            <button
              className={isTurnInFlight ? stopButtonClass : sendButtonClass}
              disabled={!isTurnInFlight && !canSubmit}
              aria-label={isTurnInFlight ? t("stop-generating") : t("send")}
              onClick={() => {
                if (isTurnInFlight) {
                  stopTurn()
                } else {
                  newMessageMutation.mutate(newMessage)
                }
              }}
            >
              {isTurnInFlight ? <Stop /> : <PaperAirplane />}
            </button>
          </div>
        </div>
        <div
          className={css`
            margin: 0.5rem;
            font-size: 0.8rem;
            color: ${baseTheme.colors.gray[500]};
            text-align: center;
          `}
        >
          {t("warning-chatbots-can-make-mistakes")}
        </div>
      </div>
    )
  }

  return (
    <>
      <VisuallyHidden aria-live="polite" role="status">
        {chatbotMessageAnnouncement}
      </VisuallyHidden>
      {renderBody()}
    </>
  )
}

export default React.memo(ChatbotChatBody)
