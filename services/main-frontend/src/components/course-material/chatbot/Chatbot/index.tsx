"use client"

import React from "react"

import ChatbotChat from "../shared/ChatbotChat"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  return (
    <ChatbotChat chatbotConfigurationId={chatbotConfigurationId} isCourseMaterialBlock={false} />
  )
}

export default React.memo(Chatbot)
