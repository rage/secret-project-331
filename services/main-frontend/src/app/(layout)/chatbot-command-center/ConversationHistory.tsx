"use client"

import type {
  ChatbotConversation,
  ChatbotConversationFirstMessage,
} from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
  setValue: UseFormSetValue<ChatbotConfiguration>
  messages: ChatbotConversationFirstMessage[]
  chatbots: ChatbotConfiguration[]
}

import { css } from "@emotion/css"
import type { UseFormSetValue } from "react-hook-form"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  messages,
  setValue,
  chatbots,
}) => {
  const conversationsAndFirstMessages = conversations.map((conversation) => {
    const firstMessage = messages.find(
      (message) => message.conversation_id === conversation.id,
    )?.text
    const chatbotName = chatbots.find(
      (chatbot) => chatbot.id === conversation.chatbot_configuration_id,
    )?.chatbot_name
    return { ...conversation, firstMessage, chatbotName }
  })
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      `}
    >
      {conversationsAndFirstMessages.map((conversation) => (
        <div key={conversation.id}>
          <Button
            size="medium"
            variant="icon"
            onClick={() => {
              setConversationId(conversation.id)
              setValue("id", conversation.chatbot_configuration_id, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }}
          >
            <div
              className={css`
                display: flex;
                flex-direction: column;
                align-items: flex-start;
              `}
            >
              {conversation.firstMessage !== undefined
                ? conversation.firstMessage
                : // oxlint-disable-next-line i18next/no-literal-string
                  "untitled conversation"}
              <span
                className={css`
                  padding-top: 0.25rem;
                  font-size: 14px;
                `}
              >
                {conversation.chatbotName}
              </span>
            </div>
          </Button>
        </div>
      ))}
    </div>
  )
}

export default ConversationHistory
