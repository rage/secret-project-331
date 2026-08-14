"use client"

import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"
import { Button } from "@/shared-module/components"

interface SideBarProps {
  setSelectedConversationId: React.Dispatch<string>
  conversations: ChatbotConversation[]
}
import AIChat from "@/img/course-material/ai-chat.svg"

const SideBar: React.FC<SideBarProps> = ({ setSelectedConversationId, conversations }) => {
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
              setSelectedConversationId(conversation.id)
            }}
          >
            {conversation.created_at}
          </Button>
        </div>
      ))}
    </div>
  )
}

export default SideBar
