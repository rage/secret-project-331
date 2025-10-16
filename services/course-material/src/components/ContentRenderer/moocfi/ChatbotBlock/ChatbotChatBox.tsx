import { css } from "@emotion/css"
import React, { useState } from "react"

import ChatbotChatBody from "@/components/chatbot/shared/ChatbotChatBody"
import ChatbotChatHeader from "@/components/chatbot/shared/ChatbotChatHeader"
import useNewConversationMutation from "@/hooks/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/chatbot/useCurrentConversationInfo"
import { baseTheme } from "@/shared-module/common/styles"

export interface ChatbotChatBoxProps {
  chatbotConfigurationId: string
}

const ChatbotChatBox: React.FC<ChatbotChatBoxProps> = ({ chatbotConfigurationId }) => {
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
        display: flex;
        flex-direction: column;
        height: inherit;
        width: inherit;
        box-shadow: inset 0 0 0 1px ${baseTheme.colors.gray[100]};
        background: white;
        border-radius: 10px;
      `}
    >
      <ChatbotChatHeader
        chatbotConfigurationId={chatbotConfigurationId}
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
        isCourseMaterialBlock={true}
      />
      <ChatbotChatBody
        chatbotConfigurationId={chatbotConfigurationId}
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

export default ChatbotChatBox
