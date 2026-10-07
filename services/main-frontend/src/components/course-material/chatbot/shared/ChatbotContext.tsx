"use client"

import { createContext, useContext } from "react"

import type { ChatbotStateAndData } from "./hooks/useChatbotStateAndData"

const ChatbotContext = createContext<ChatbotStateAndData | null>(null)

export const useChatbotContext = (): ChatbotStateAndData => {
  const chatbotContext = useContext(ChatbotContext)

  if (!chatbotContext) {
    throw new Error("Call without context value")
  }

  return chatbotContext
}

export default ChatbotContext
