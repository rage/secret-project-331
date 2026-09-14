"use client"

import { useAtomValue } from "jotai"
import React from "react"

import { currentPageIdAtom } from "@/state/course-material/selectors"

import ChatbotChat from "../shared/ChatbotChat"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const pageId = useAtomValue(currentPageIdAtom)
  return (
    <ChatbotChat
      chatbotConfigurationId={chatbotConfigurationId}
      isCourseMaterialBlock={false}
      pageId={pageId}
    />
  )
}

export default React.memo(Chatbot)
