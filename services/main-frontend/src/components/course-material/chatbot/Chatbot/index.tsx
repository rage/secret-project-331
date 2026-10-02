"use client"

import { useAtomValue } from "jotai"
import React from "react"

import { currentPageIdAtom } from "@/state/course-material/selectors"

import ChatbotChat from "../shared/ChatbotChat"
import ChatbotDialog from "./ChatbotDialog"

export interface ChatbotProps {
  chatbotConfigurationId: string
}

const Chatbot: React.FC<ChatbotProps> = ({ chatbotConfigurationId }) => {
  const pageId = useAtomValue(currentPageIdAtom)

  return (
    <ChatbotChat
      chatbotConfigurationId={chatbotConfigurationId}
      isAlwaysOpen={false}
      pageId={pageId}
    >
      <ChatbotDialog />
    </ChatbotChat>
  )
}

export default React.memo(Chatbot)
