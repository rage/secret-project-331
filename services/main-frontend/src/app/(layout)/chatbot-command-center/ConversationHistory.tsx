"use client"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
  setValue: UseFormSetValue<ChatbotConfiguration>
}

import type { UseFormSetValue } from "react-hook-form"

import type { ChatbotConfiguration } from "@/generated/api/types.generated"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
  setValue,
}) => {
  return (
    <div>
      {conversations.map((conversation) => (
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
            {conversation.created_at}
          </Button>
        </div>
      ))}
    </div>
  )
}

export default ConversationHistory
