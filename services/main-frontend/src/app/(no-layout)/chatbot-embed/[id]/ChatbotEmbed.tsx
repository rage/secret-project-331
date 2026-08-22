"use client"

import { useParams } from "next/navigation"

import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()

  const chatbotStateAndData = useChatbotStateAndData(id, undefined, null)

  return (
    <div>
      <ChatbotChatBox {...chatbotStateAndData} />
    </div>
  )
}

export default ChatbotEmbed
