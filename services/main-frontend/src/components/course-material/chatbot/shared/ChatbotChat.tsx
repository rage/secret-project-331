"use client"

import React from "react"

import ChatbotContext from "./ChatbotContext"
import useChatbotStateAndData from "./hooks/useChatbotStateAndData"
import useSynchronizeDefaultChatbotCommunicationChannel from "./hooks/useSynchronizeDefaultChatbotCommunicationChannel"

interface ChatbotChatProps {
  chatbotConfigurationId: string
  isAlwaysOpen: boolean
  conversationId: string | null
  /** The course material page to send as context with a message, or null where there is none. */
  pageId: string | null
  children: React.ReactNode
}
// TODO: document that this component will handle all the necessary setup and data for the chatbot
const ChatbotChat: React.FC<ChatbotChatProps> = ({
  chatbotConfigurationId,
  isAlwaysOpen,
  conversationId,
  pageId,
  children,
}) => {
  const chatbotStateAndData = useChatbotStateAndData(chatbotConfigurationId, conversationId, pageId)

  useSynchronizeDefaultChatbotCommunicationChannel(
    isAlwaysOpen,
    chatbotStateAndData.currentConversationInfo,
    chatbotStateAndData.newMessageMutation.mutateAsync,
    chatbotStateAndData.newConversationMutation.mutateAsync,
    chatbotStateAndData.dispatch,
    chatbotStateAndData.isTurnInFlight,
  )

  return <ChatbotContext value={chatbotStateAndData}>{children}</ChatbotContext>

  // return (
  //   <>
  //     {isAlwaysOpen && <ChatbotChatBox {...chatbotStateAndData} />}
  //     {!isAlwaysOpen && (
  //       <ChatbotDialog
  //         chatbotStateAndData={chatbotStateAndData}
  //         isOpen={isOpen}
  //         setIsOpen={setIsOpen}
  //       />
  //     )}
  //   </>
  // )
}

export default ChatbotChat
