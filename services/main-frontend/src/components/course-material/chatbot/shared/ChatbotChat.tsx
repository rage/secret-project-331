"use client"

import React, { useState } from "react"

import type { ChatbotSurface } from "@/generated/course-material-api/types.generated"

import ChatbotChatBox from "../../ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import ChatbotDialog from "../Chatbot/ChatbotDialog"
import useChatbotStateAndData from "./hooks/useChatbotStateAndData"
import useSynchronizeDefaultChatbotCommunicationChannel from "./hooks/useSynchronizeDefaultChatbotCommunicationChannel"

interface ChatbotChatProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: boolean
  surface: ChatbotSurface
}

const ChatbotChat: React.FC<ChatbotChatProps> = ({
  chatbotConfigurationId,
  isCourseMaterialBlock,
  surface,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const chatbotStateAndData = useChatbotStateAndData(
    chatbotConfigurationId,
    isCourseMaterialBlock ? undefined : setIsOpen,
    surface,
  )

  useSynchronizeDefaultChatbotCommunicationChannel(
    isCourseMaterialBlock,
    chatbotStateAndData.currentConversationInfo,
    chatbotStateAndData.newMessageMutation.mutateAsync,
    chatbotStateAndData.newConversationMutation.mutateAsync,
    chatbotStateAndData.dispatch,
  )

  return (
    <>
      {isCourseMaterialBlock && <ChatbotChatBox {...chatbotStateAndData} />}
      {!isCourseMaterialBlock && (
        <ChatbotDialog
          chatbotStateAndData={chatbotStateAndData}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      )}
    </>
  )
}

export default ChatbotChat
