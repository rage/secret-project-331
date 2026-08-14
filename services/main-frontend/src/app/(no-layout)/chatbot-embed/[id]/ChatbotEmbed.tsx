"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"

import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()

  const currentConversationId = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: id,
      },
    }),
  )

  const conversationId = currentConversationId.data

  const chatbotStateAndData = useChatbotStateAndData(id, undefined, conversationId)

  return (
    <div>
      <ChatbotChatBox {...chatbotStateAndData} />
    </div>
  )
}

export default ChatbotEmbed
