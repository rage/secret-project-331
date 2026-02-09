"use client"

import { css, keyframes } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { PaperAirplane } from "@vectopus/atlas-icons-react"
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react"
import { VisuallyHidden } from "react-aria"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { CHATBOX_HEIGHT_PX } from "../Chatbot/ChatbotDialog"

import ErrorDisplay from "./ErrorDisplay"
import MessageBubble from "./MessageBubble"

import { sendChatbotMessage } from "@/services/course-material/backend"
import {
  ChatbotConversation,
  ChatbotConversationInfo,
  ChatbotConversationMessageCitation,
} from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

const loadAnimation = keyframes`
100%{
      background-position: -100% 0;
  }
`

interface ChatbotChatBodyProps {
  chatbotConfigurationId: string
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  newConversation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: Error | null
  setError: (error: Error | null) => void
}

interface MessageState {
  optimisticMessage: string | null
  streamingMessage: string | null
}

type MessageAction =
  | { type: "SET_OPTIMISTIC_MESSAGE"; payload: string | null }
  | { type: "APPEND_STREAMING_MESSAGE"; payload: string }
  | { type: "RESET_MESSAGES" }

const messageReducer = (state: MessageState, action: MessageAction): MessageState => {
  switch (action.type) {
    case "SET_OPTIMISTIC_MESSAGE":
      return { ...state, optimisticMessage: action.payload }
    case "APPEND_STREAMING_MESSAGE":
      return { ...state, streamingMessage: (state.streamingMessage || "") + action.payload }
    case "RESET_MESSAGES":
      return { optimisticMessage: null, streamingMessage: null }
    default:
      return state
  }
}

const ChatbotChatBody: React.FC<ChatbotChatBodyProps> = ({
  currentConversationInfo,
  newConversation,
  chatbotConfigurationId,
  newMessage,
  setNewMessage,
  error,
  setError,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [messageState, dispatch] = useReducer(messageReducer, {
    optimisticMessage: null,
    streamingMessage: null,
  })

  let suggestedMessages = useMemo(() => {
    let msgs = currentConversationInfo.data?.suggested_messages
  }, [currentConversationInfo.data?.suggested_messages])

  const newMessageMutation = useToastMutation(
    async () => {
      if (!currentConversationInfo.data?.current_conversation) {
        throw new Error("No active conversation")
      }
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      const message = newMessage.trim()
      dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: message })
      setNewMessage("")
      const stream = await sendChatbotMessage(
        chatbotConfigurationId,
        currentConversationInfo.data.current_conversation.id,
        message,
      )
      const reader = stream.getReader()

      let done = false
      while (!done) {
        const { done: doneReading, value } = await reader.read()
        done = doneReading
        if (value) {
          const valueAsString = new TextDecoder().decode(value)
          const lines = valueAsString.split("\n")
          for (const line of lines) {
            if (line?.indexOf("{") !== 0) {
              continue
            }
            try {
              const parsedValue = JSON.parse(line)
              if (parsedValue.text) {
                dispatch({ type: "APPEND_STREAMING_MESSAGE", payload: parsedValue.text })
              }
            } catch (e) {
              console.error(e)
            }
          }
        }
      }
      return stream
    },
    { notify: false },
    {
      onSuccess: async () => {
        await currentConversationInfo.refetch()
        dispatch({ type: "RESET_MESSAGES" })
        setError(null)
        setChatbotMessageAnnouncement(t("chatbot-finished-responding"))
      },
      onError: async (error) => {
        if (error instanceof Error) {
          setError(error)
          dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: null })
        } else {
          console.error(`Failed to send chat message: ${error}`)
          setError(new Error("Unknown error occurred"))
        }
        await currentConversationInfo.refetch()
      },
    },
  )

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
      <div
        className={css`
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 20px;
          overflow: hidden;

          h2 {
            font-size: 24px;
            margin-bottom: 10px;
          }

          p {
            margin-bottom: 5px;
          }

          ul {
            margin-bottom: 10px;
            padding-left: 20px;
          }

          li {
            margin-bottom: 5px;
          }
        `}
      >
        <div
          className={css`
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            overflow: scroll;
          `}
        >
          <h2>{t("about-the-chatbot")}</h2>
          <p>{t("chatbot-disclaimer-start")}</p>
          <ul>
            <li>{t("chatbot-discalimer-sensitive-information")}</li>
            <li>{t("chatbot-disclaimer-check")}</li>
            <li>
              {t("chatbot-disclaimer-disclose-part-1")}
              <a href="https://studies.helsinki.fi/instructions/article/using-ai-support-learning">
                {" "}
                {t("chatbot-disclaimer-disclose-part-2")}
              </a>
              .{" "}
            </li>
          </ul>
        </div>
        <Button
          className={css`
            margin-top: 6px;
          `}
          size="medium"
          variant="secondary"
          onClick={() => {
            newConversation.mutate()
            dispatch({ type: "RESET_MESSAGES" })
          }}
        >
          {t("button-text-agree")}
        </Button>
      </div>
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
      </div>
      <VisuallyHidden aria-live="polite" role="status">
        {chatbotMessageAnnouncement}
      </VisuallyHidden>
      {error && <ErrorDisplay error={error} />}
      <div
        className={css`
          display: flex;
          overflow-x: auto;
          overflow-y: hidden;
          height: 4.6rem;
          gap: 10px;
          align-items: flex-end;
          margin: 0 1rem;
        `}
      >
        {currentConversationInfo.data.suggested_messages?.map((m) => {
          let message = m.message.split(" ")
          console.log(message)
          let half = m.message.length / 2

          let line1 = message.slice(0, half).join(" ")
          let line2 = message.slice(half).join(" ")
          console.log("lin1: ", line1, "line2:", line2)
          return (
            <div
              key={m.id}
              className={css`
                display: flex;
                flex: auto;
                flex-shrink: 0;
                justify-content: center;
                overflow-wrap: break-word;
                padding: 0.4rem;
                border-radius: 8px;
                margin: 0.5rem 0;
                font-size: 0.8rem;
                background: linear-gradient(
                  120deg,
                  ${baseTheme.colors.blue[100]} 30%,
                  #ffffff 38%,
                  #f2f2f2 40%,
                  ${baseTheme.colors.blue[100]} 48%
                );
                background-size: 200% 100%;
                background-position: 100% 0;
                ${newMessageMutation.isPending
                  ? `animation: ${loadAnimation} 2s infinite; color: rgb(0 0 0 / 0%);`
                  : ""}
              `}
            >
              {line1}
              <br></br>
              {line2}
            </div>
          )
        })}
      </div>
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
                setChatbotMessageAnnouncement("")
                e.preventDefault()
                if (canSubmit) {
                  newMessageMutation.mutate()
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
              setChatbotMessageAnnouncement("")
              newMessageMutation.mutate()
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
