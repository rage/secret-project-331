"use client"

import React from "react"

import type { ChatbotSurface } from "@/generated/course-material-api/types.generated"

import ChatbotChat from "../shared/ChatbotChat"

const SURFACE: ChatbotSurface = "course_material_dialog"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  return (
    <ChatbotChat
      chatbotConfigurationId={chatbotConfigurationId}
      isCourseMaterialBlock={false}
      surface={SURFACE}
    />
  )
}

export default React.memo(Chatbot)
