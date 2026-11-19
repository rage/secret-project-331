"use client"

import React, { useMemo } from "react"

import ChatbotContext from "./ChatbotContext"
import type { ChatbotEndpoints } from "./chatbotEndpoints"
import courseMaterialChatbotEndpoints from "./courseMaterialChatbotEndpoints"
import type { ActionExecutedHandler } from "./hooks/useChatbotStateAndData"
import useChatbotStateAndData from "./hooks/useChatbotStateAndData"
import useSynchronizeDefaultChatbotCommunicationChannel from "./hooks/useSynchronizeDefaultChatbotCommunicationChannel"

type ChatbotChatProps = {
  isAlwaysOpen: boolean
  /** The course material page to send as context with a message, or null where there is none. */
  pageId: string | null
  onActionExecuted?: ActionExecutedHandler
  children: React.ReactNode
} & (
  | { chatbotConfigurationId: string | null; endpoints?: never }
  /** Another backend than the course material chatbot; see `ChatbotEndpoints`. */
  | { endpoints: ChatbotEndpoints; chatbotConfigurationId?: never }
)

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
  endpoints,
  isAlwaysOpen,
  pageId,
  onActionExecuted,
  children,
}) => {
  const courseMaterialEndpoints = useMemo(
    () => courseMaterialChatbotEndpoints(chatbotConfigurationId ?? null),
    [chatbotConfigurationId],
  )
  const chatbotStateAndData = useChatbotStateAndData(
    endpoints ?? courseMaterialEndpoints,
    pageId,
    isAlwaysOpen,
    onActionExecuted,
  )

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
