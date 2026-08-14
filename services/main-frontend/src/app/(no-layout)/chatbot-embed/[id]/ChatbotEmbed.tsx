"use client"

import { useParams } from "next/navigation"

import useChatbotStateAndData from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import type { ChatbotSurface } from "@/generated/course-material-api/types.generated"

const SURFACE: ChatbotSurface = "embed"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()

  const chatbotStateAndData = useChatbotStateAndData(id, undefined, SURFACE)

  return (
    <div>
      <ChatbotChatBox {...chatbotStateAndData} />
    </div>
  )
}

export default ChatbotEmbed
