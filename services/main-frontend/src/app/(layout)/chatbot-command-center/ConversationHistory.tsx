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
}

import type { UseFormSetValue } from "react-hook-form"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  messages,
  setValue,
}) => {
  const conversationsAndFirstMessages = conversations.map((conversation) => {
    const firstMessage = messages.find(
      (message) => message.conversation_id === conversation.id,
    )?.text
    return { ...conversation, firstMessage }
  })

  return (
    <div>
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
            {conversation.firstMessage !== undefined
              ? conversation.firstMessage
              : // oxlint-disable-next-line i18next/no-literal-string
                "untitled conversation"}
          </Button>
        </div>
      ))}
    </div>
  )
}

export default ConversationHistory
