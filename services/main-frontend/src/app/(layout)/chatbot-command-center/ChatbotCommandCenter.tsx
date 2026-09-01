"use client"

import type React from "react"
import { useState } from "react"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import type { ChatbotConfiguration, Course } from "@/generated/api/types.generated"
import type { ChatbotConversation } from "@/generated/course-material-api/types.generated"

import ChatbotCommandCenterImpl from "./ChatbotCommandCenterImpl"

interface ChatbotCommandCenterProps {
  chatbots: ChatbotConfiguration[]
  courses: Course[]
  conversations: ChatbotConversation[]
}

const ChatbotCommandCenter: React.FC<ChatbotCommandCenterProps> = ({
  chatbots,
  courses,
  conversations,
}) => {
  const [configurationId, setConfigurationId] = useState<null | string>(null)

  return (
    <ChatbotChat chatbotConfigurationId={configurationId} isAlwaysOpen={true} pageId={null}>
      <ChatbotCommandCenterImpl
        chatbots={chatbots}
        courses={courses}
        conversations={conversations}
        configurationId={configurationId}
        setConfigurationId={setConfigurationId}
      />
    </ChatbotChat>
  )
}

export default ChatbotCommandCenter
