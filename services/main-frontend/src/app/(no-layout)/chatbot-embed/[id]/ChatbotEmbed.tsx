"use client"

import { useParams } from "next/navigation"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()

  return (
    <ChatbotChat chatbotConfigurationId={id} isAlwaysOpen={false} pageId={null}>
      <ChatbotChatBox />
    </ChatbotChat>
  )
}

export default ChatbotEmbed
