import { css } from "@emotion/css"
import { UseQueryResult } from "@tanstack/react-query"
import { PaperAirplane } from "@vectopus/atlas-icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { ChatbotDialogProps } from "./ChatbotDialog"
import ThinkingIndicator from "./ThinkingIndicator"

import { newChatbotConversation, sendChatbotMessage } from "@/services/backend"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"

const ChatbotDialogBody: React.FC<
  ChatbotDialogProps & { currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error> }
> = ({ currentConversationInfo, chatbotConfigurationId }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const { t } = useTranslation()

  const [newMessage, setNewMessage] = useState("")
  const [optimisticSentMessage, setOptimisticSentMessage] = useState<string | null>(null)
  const [streamingMessage, setStreamingMessage] = useState<string | null>(null)

  const newConversationMutation = useToastMutation(
    () => newChatbotConversation(chatbotConfigurationId),
    { notify: false },
    {
      onSuccess: () => {
        currentConversationInfo.refetch()
      },
    },
  )

  const newMessageMutation = useToastMutation(
    async () => {
      if (!currentConversationInfo.data?.current_conversation) {
        throw new Error("No active conversation")
      }
      const message = newMessage
      setOptimisticSentMessage(message)
      setNewMessage("")
      const stream = await sendChatbotMessage(
        chatbotConfigurationId,
        currentConversationInfo.data.current_conversation.id,
        message,
      )
      const reader = stream.getReader()

      let done = false
      let value = undefined
      while (!done) {
        ;({ done, value } = await reader.read())
        const valueAsString = new TextDecoder().decode(value)
        const lines = valueAsString.split("\n")
        for (const line of lines) {
          if (line?.indexOf("{") !== 0) {
            continue
          }
          console.log(line)
          try {
            const parsedValue = JSON.parse(line)
            console.log(parsedValue)
            if (parsedValue.text) {
              setStreamingMessage((prev) => `${prev || ""}${parsedValue.text}`)
            }
          } catch (e) {
            // NOP
            console.error(e)
          }
        }
      }
      return stream
    },
    { notify: false },
    {
      onSuccess: async (stream) => {
        await currentConversationInfo.refetch()
        setStreamingMessage(null)
        setOptimisticSentMessage(null)
      },
    },
  )

  const messages = useMemo(() => {
    const messages = [...(currentConversationInfo.data?.current_conversation_messages ?? [])]
    const lastOrderNumber = Math.max(...messages.map((m) => m.order_number))
    if (optimisticSentMessage) {
      messages.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: v4(),
        message: optimisticSentMessage,
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
    if (streamingMessage) {
      messages.push({
        // eslint-disable-next-line i18next/no-literal-string
        id: v4(),
        message: streamingMessage,
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
    optimisticSentMessage,
    streamingMessage,
  ])

  const scrollToBottom = useCallback(() => {
    if (!scrollContainerRef.current) {
      return
    }
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
  }, [scrollContainerRef])

  useEffect(() => {
    // Whenever the messages change, scroll to the bottom
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
    return <ErrorBanner error={currentConversationInfo.error} variant="readOnly" />
  }

  if (currentConversationInfo && !currentConversationInfo.data?.current_conversation) {
    // The chatbot has loaded, but no conversation is active. Show the warning message.
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
          <h2>About the chatbot</h2>

          <p>
            You are opening a chatbot based on a large language model (LLM). To use this chatbot,
            you must agree that you will...
          </p>

          <ul>
            <li>
              <b>Never disclose any sensitive information to the chatbot.</b>
            </li>
            <li>
              <b>Always check the claims made by the chatbot.</b> LLM-based chatbots can produce
              highly convincing but factually incorrect statements.
            </li>
            <li>
              <b>Always disclose use of LLMs in your studies.</b> You can find the University of
              Helsinki guidance on use of LLMs in studies{" "}
              <a href="https://studies.helsinki.fi/instructions/article/using-ai-support-learning">
                here
              </a>
              .{" "}
            </li>
          </ul>
        </div>

        <Button size="medium" variant="secondary" onClick={() => newConversationMutation.mutate()}>
          Agree
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
          <div
            className={css`
              padding: 1rem;
              border-radius: 10px;
              width: fit-content;
              margin: 0.5rem 0;
              ${message.is_from_chatbot &&
              `margin-right: 2rem;
                align-self: flex-start;
                background-color: ${baseTheme.colors.gray[100]};
                `}
              ${!message.is_from_chatbot &&
              `margin-left: 2rem;
                align-self: flex-end;
                border: 2px solid ${baseTheme.colors.gray[200]};
                `}
            `}
            key={`chatbot-message-${message.id}`}
          >
            <span>{message.message}</span>
            {!message.message_is_complete && newMessageMutation.isPending && (
              <ThinkingIndicator key="chat-message-thinking-indicator" />
            )}
          </div>
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
              if (e.key === "Enter") {
                e.preventDefault()
                if (canSubmit) {
                  newMessageMutation.mutate()
                }
              }
            }}
            placeholder="Message"
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
        Chatbots can make mistakes. Always double-check its claims.
      </div>
    </div>
  )
}

export default ChatbotDialogBody
