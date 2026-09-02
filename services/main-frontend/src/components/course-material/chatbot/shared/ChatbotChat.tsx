"use client"

import React from "react"

import ChatbotContext from "./ChatbotContext"
import useChatbotStateAndData from "./hooks/useChatbotStateAndData"
import useSynchronizeDefaultChatbotCommunicationChannel from "./hooks/useSynchronizeDefaultChatbotCommunicationChannel"

interface ChatbotChatProps {
  chatbotConfigurationId: string
  isAlwaysOpen: boolean
  /** The course material page to send as context with a message, or null where there is none. */
  pageId: string | null
  children: React.ReactNode
}

/**
 * Handles all the necessary setup and data for the chatbot.
 *
 * Passess chatbot state and data down to its children using ChatbotContext. Children
 * can access the context using the useChatbotContext hook.
 *
 * @example
 * <ChatbotChat chatbotConfigurationId="123" isAlwaysOpen={true} pageId={null}>
 *   <ChatbotChatBox />
 * </ChatbotChat>
 *
 * @example
 * <ChatbotChat chatbotConfigurationId="123" isAlwaysOpen={false} pageId="page123">
 *   <ChatbotDialog />
 * </ChatbotChat>
 */
const ChatbotChat: React.FC<ChatbotChatProps> = ({
  chatbotConfigurationId,
  isAlwaysOpen,
  pageId,
  children,
}) => {
  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, pageId)

  useSynchronizeDefaultChatbotCommunicationChannel(
    isAlwaysOpen,
    chatbotStateAndData.currentConversationInfo,
    chatbotStateAndData.newMessageMutation.mutateAsync,
    chatbotStateAndData.newConversationMutation.mutateAsync,
    chatbotStateAndData.dispatch,
    chatbotStateAndData.isTurnInFlight,
  )

  return <ChatbotContext value={chatbotStateAndData}>{children}</ChatbotContext>
}

export default ChatbotChat
