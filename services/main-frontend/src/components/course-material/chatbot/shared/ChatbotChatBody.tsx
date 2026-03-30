"use client"

import { css } from "@emotion/css"
import { PaperAirplane } from "@vectopus/atlas-icons-react"
import React, { useCallback, useEffect, useMemo, useRef } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { CHATBOX_HEIGHT_PX } from "../Chatbot/ChatbotDialog"

import ChatbotDisclaimer from "./ChatbotDisclaimer"
import ErrorDisplay from "./ErrorDisplay"
import MessageBubble from "./MessageBubble"
import SuggestedMessageChip from "./SuggestedMessageChip"
import { ChatbotStateAndData } from "./hooks/useChatbotStateAndData"

import { ChatbotConversationMessageCitation } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles"

const ChatbotChatBody: React.FC<ChatbotStateAndData> = ({
  currentConversationInfo,
  newConversationMutation,
  newMessage,
  setNewMessage,
  error,
  messageState,
  chatbotMessageAnnouncement,
  dispatch,
  newMessageMutation,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const citations = useMemo(() => {
    const citations: Map<string, ChatbotConversationMessageCitation[]> = new Map()

    if (!currentConversationInfo.data?.hide_citations) {
      currentConversationInfo.data?.current_conversation_message_citations?.forEach((cit) => {
        const id = cit.conversation_message_id
        if (!citations.has(id)) {
          citations.set(id, [cit])
        } else {
          // id is definitely in hashmap because of the condition branch we're in
          citations.set(id, citations.get(id)!.concat(cit))
        }
      })
    }

    return citations
  }, [
    currentConversationInfo.data?.current_conversation_message_citations,
    currentConversationInfo.data?.hide_citations,
  ])

  const messages = useMemo(() => {
    const messages = [
      ...(currentConversationInfo.data?.current_conversation_messages?.filter(
        (m) => m.message_role !== "tool" && m.tool_call_fields.length === 0,
      ) ?? []),
    ]
    const lastOrderNumber = Math.max(...messages.map((m) => m.order_number), 0)
    if (messageState.optimisticMessage) {
      messages.push({
        id: v4(),
        message: messageState.optimisticMessage,
        // eslint-disable-next-line i18next/no-literal-string
        message_role: "user",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        conversation_id: currentConversationInfo.data?.current_conversation?.id ?? "",
        message_is_complete: true,
        used_tokens: 0,
        order_number: lastOrderNumber + 1,
        tool_call_fields: [],
        tool_output: null,
      })
    }
    if (messageState.streamingMessage) {
      messages.push({
        id: v4(),
        message: messageState.streamingMessage,
        // eslint-disable-next-line i18next/no-literal-string
        message_role: "assistant",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        conversation_id: currentConversationInfo.data?.current_conversation?.id ?? "",
        message_is_complete: false,
        used_tokens: 0,
        order_number: lastOrderNumber + 2,
        tool_call_fields: [],
        tool_output: null,
      })
    }
    return messages
  }, [
    currentConversationInfo.data?.current_conversation?.id,
    currentConversationInfo.data?.current_conversation_messages,
    messageState.optimisticMessage,
    messageState.streamingMessage,
  ])

  const scrollToBottom = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [scrollToBottom, messages])

  const canSubmit = useMemo(
    () => Boolean(newMessage && newMessage.trim().length > 0 && !newMessageMutation.isPending),
    [newMessage, newMessageMutation.isPending],
  )

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
        <ErrorBanner error={currentConversationInfo.error} variant="readOnly" />
        <Button onClick={() => currentConversationInfo.refetch()} variant="secondary" size="small">
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
              dispatch({ type: "RESET_MESSAGES" })
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
      <div
        className={css`
          flex-grow: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          padding: 1rem;
        `}
        ref={scrollContainerRef}
      >
        {messages.map((message) => (
          <MessageBubble
            key={`chatbot-message-${message.id}`}
            message={message.message ?? ""}
            citations={citations.get(message.id)}
            isFromChatbot={message.message_role === "assistant"}
            isPending={!message.message_is_complete && newMessageMutation.isPending}
          />
        ))}
        <div
          className={css`
            display: flex;
            flex-flow: column nowrap;
            margin-top: auto;
            margin-left: 2rem;
          `}
        >
          {currentConversationInfo.data.suggested_messages?.map((m) => (
            <SuggestedMessageChip
              key={m.id}
              isLoading={
                newMessageMutation.isPending ||
                currentConversationInfo.isLoading ||
                currentConversationInfo.isRefetching
              }
              message={m.message}
              handleClick={() => {
                if (!newMessageMutation.isPending) {
                  newMessageMutation.mutate(m.message)
                }
              }}
            />
          ))}
        </div>
      </div>
      <VisuallyHidden aria-live="polite" role="status">
        {chatbotMessageAnnouncement}
      </VisuallyHidden>
      {error && <ErrorDisplay error={error} />}
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
            // eslint-disable-next-line i18next/no-literal-string
            resize={"none"}
            autoResize={true}
            onAutoResized={scrollToBottom}
            autoResizeMaxHeightPx={CHATBOX_HEIGHT_PX * 0.4}
            placeholder={t("label-message")}
          />
        </div>
        <div>
          <button
            className={css`
              background-color: ${baseTheme.colors.green[200]};
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

              svg {
                position: relative;
                top: 0px;
                left: -2px;
                transform: rotate(45deg);
              }
            `}
            disabled={!canSubmit}
            aria-label={t("send")}
            onClick={() => {
              newMessageMutation.mutate(newMessage)
            }}
          >
            <PaperAirplane />
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

export default React.memo(ChatbotChatBody)
