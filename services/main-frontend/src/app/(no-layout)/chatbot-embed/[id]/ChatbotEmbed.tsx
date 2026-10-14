"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBox from "@/components/course-material/ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"

const ChatbotEmbed = () => {
  const { id } = useParams<{ id: string }>()

  return (
    <div
      className={css`
        height: 100vh;
      `}
    >
      <ChatbotChat chatbotConfigurationId={id} isAlwaysOpen={true} pageId={null}>
        <ChatbotChatBox />
      </ChatbotChat>
    </div>
  )
}

export default ChatbotEmbed
