"use client"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface ConversationHistory {
  setConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
}

import AIChat from "@/img/course-material/ai-chat.svg"

const ConversationHistory: React.FC<ConversationHistory> = ({
  setConversationId,
  conversations,
}) => {
  return (
    <div>
      {conversations.map((conversation) => (
        <div key={conversation.id}>
          <Button
            icon={<AIChat></AIChat>}
            iconPosition="start"
            size="medium"
            variant="icon"
            onClick={() => {
              setConversationId(conversation.id)
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
