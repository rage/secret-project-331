import { css } from "@emotion/css"
import React, { useState } from "react"

import ChatbotChatBody from "../shared/ChatbotChatBody"
import ChatbotChatHeader from "../shared/ChatbotChatHeader"

import { CHATBOX_HEIGHT_PX, CHATBOX_WIDTH_PX } from "./ChatbotDialog"

import useNewConversationMutation from "@/hooks/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/chatbot/useCurrentConversationInfo"

interface ChatbotDialogProps {
  chatbotConfigurationId: string
  chatbotTitleId: string
  isCourseMaterialBlock: false
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
        width: ${CHATBOX_WIDTH_PX}px;
        max-width: 90vw;
        height: ${CHATBOX_HEIGHT_PX}px;
        max-height: 90vh;
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
