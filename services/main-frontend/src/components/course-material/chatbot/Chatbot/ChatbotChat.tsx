"use client"

import { css } from "@emotion/css"
import React, { DOMAttributes, useState } from "react"

import ChatbotChatBody from "../shared/ChatbotChatBody"
import ChatbotChatHeader from "../shared/ChatbotChatHeader"

import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"

interface ChatbotDialogProps {
  chatbotConfigurationId: string
  closeChatbot: () => void
  isCourseMaterialBlock: false
  titleProps: DOMAttributes<Element>
}

interface ChatbotNoDialogProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: true
}

export type DiscrChatbotDialogProps = ChatbotDialogProps | ChatbotNoDialogProps

const ChatbotChat: React.FC<ChatbotDialogProps> = (props) => {
  const { chatbotConfigurationId } = props

  const [newMessage, setNewMessage] = React.useState("")
  const [error, setError] = useState<Error | null>(null)

  const currentConversationInfoQuery = useCurrentConversationInfo(chatbotConfigurationId)
  const newConversationMutation = useNewConversationMutation(
    chatbotConfigurationId,
    currentConversationInfoQuery,
    setNewMessage,
    setError,
  )

  return (
    <div
      className={css`
        width: inherit;
        max-width: inherit;
        min-width: inherit;
        height: inherit;
        max-height: inherit;
        min-height: inherit;
        bottom: 70px;
        right: 1rem;
        background: white;
        border-radius: 10px;
        box-shadow: 0px 4px 10px rgba(177, 179, 184, 0.6);
        z-index: 1000;
        display: flex;
        flex-direction: column;
      `}
    >
      <ChatbotChatHeader
        {...props}
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
        isCourseMaterialBlock={false}
      />
      <ChatbotChatBody
        {...props}
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        error={error}
        setError={setError}
      />
    </div>
  )
}

export default ChatbotChat
