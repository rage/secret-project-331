import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { PaperAirplane } from "@vectopus/atlas-icons-react"
import React, { useCallback, useEffect, useMemo, useReducer, useRef } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { ChatbotDialogProps } from "./ChatbotDialog"
import MessageBubble from "./MessageBubble"

import { newChatbotConversation, sendChatbotMessage } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

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

const ChatbotDialogBody: React.FC<
  ChatbotDialogProps & { currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error> }
> = ({ currentConversationInfo, chatbotConfigurationId }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  const [newMessage, setNewMessage] = React.useState("")
  const [messageState, dispatch] = useReducer(messageReducer, {
    optimisticMessage: null,
    streamingMessage: null,
  })

  const newConversationMutation = useToastMutation(
    () => newChatbotConversation(chatbotConfigurationId),
    { notify: false },
    {
      onSuccess: () => {
        currentConversationInfo.refetch()
        dispatch({ type: "RESET_MESSAGES" })
      },
    },
  )

  const newMessageMutation = useToastMutation(
    async () => {
      if (!currentConversationInfo.data?.current_conversation) {
        throw new Error("No active conversation")
      }
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
      },
    },
  )

  const messages = useMemo(() => {
    const messages = [...(currentConversationInfo.data?.current_conversation_messages ?? [])]
    const lastOrderNumber = Math.max(...messages.map((m) => m.order_number), 0)
    if (messageState.optimisticMessage) {
      messages.push({
        id: v4(),
        message: messageState.optimisticMessage,
        is_from_chatbot: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        conversation_id: currentConversationInfo.data?.current_conversation?.id ?? "",
        message_is_complete: true,
        used_tokens: 0,
        order_number: lastOrderNumber + 1,
      })
    }
    if (messageState.streamingMessage) {
      messages.push({
        id: v4(),
        message: messageState.streamingMessage,
        is_from_chatbot: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
        conversation_id: currentConversationInfo.data?.current_conversation?.id ?? "",
        message_is_complete: false,
        used_tokens: 0,
        order_number: lastOrderNumber + 2,
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
        <Button
          onClick={() => currentConversationInfo.refetch()}
          variant="secondary"
          size={"small"}
        >
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
        <Button size="medium" variant="secondary" onClick={() => newConversationMutation.mutate()}>
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
          overflow-y: scroll;
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
            isFromChatbot={message.is_from_chatbot}
            isPending={!message.message_is_complete && newMessageMutation.isPending}
          />
        ))}
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
          <textarea
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
                  newMessageMutation.mutate()
                }
              }
            }}
            placeholder={t("label-message")}
          />
        </div>
        <div>
          <button
            className={css`
              background-color: ${baseTheme.colors.gray[100]};
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
            onClick={() => newMessageMutation.mutate()}
          >
            <PaperAirplane />
          </button>
        </div>
      </div>
      <div
        className={css`
          margin: 0.5rem;
          font-size: 0.8rem;
          color: ${baseTheme.colors.gray[400]};
          text-align: center;
        `}
      >
        {t("warning-chatbots-can-make-mistakes")}
      </div>
    </div>
  )
}

export default React.memo(ChatbotDialogBody)
