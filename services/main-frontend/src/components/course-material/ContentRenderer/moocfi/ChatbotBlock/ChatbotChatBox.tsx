"use client"

import { css } from "@emotion/css"
import React from "react"

import ChatbotChat from "@/components/course-material/chatbot/shared/ChatbotChat"
import { baseTheme } from "@/shared-module/common/styles"

export interface ChatbotChatBoxProps {
  chatbotConfigurationId: string
}

const ChatbotChatBox: React.FC<ChatbotChatBoxProps> = ({ chatbotConfigurationId }) => {
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
      <ChatbotChat chatbotConfigurationId={chatbotConfigurationId} isCourseMaterialBlock={true} />
    </div>
  )
}

export default ChatbotChatBox
