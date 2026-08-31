"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import { getCurrentConversationIdOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { QueryResult } from "@/shared-module/components"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()

  const currentConversationId = useQuery(
    getCurrentConversationIdOptions({
      path: {
        chatbot_configuration_id: id,
      },
    }),
  )

  return (
    <QueryResult query={currentConversationId}>
      {(conversationId) => (
        <ChatbotChat
          conversationId={conversationId}
          chatbotConfigurationId={id}
          isAlwaysOpen={false}
          pageId={null}
        >
          <ChatbotChatBox />
        </ChatbotChat>
      )}
    </QueryResult>
  )
}

export default ChatbotEmbed
