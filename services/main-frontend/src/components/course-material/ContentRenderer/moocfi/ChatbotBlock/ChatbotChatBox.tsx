"use client"

import { css } from "@emotion/css"
import React from "react"

import ChatbotChatBody from "@/components/course-material/chatbot/shared/ChatbotChatBody"
import ChatbotChatHeader from "@/components/course-material/chatbot/shared/ChatbotChatHeader"
import { ChatbotStateAndData } from "@/components/course-material/chatbot/shared/hooks/useChatbotStateAndData"
import { baseTheme } from "@/shared-module/common/styles"

const ChatbotChatBox: React.FC<ChatbotStateAndData> = (props) => {
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
        isCourseMaterialBlock={true}
        currentConversationInfo={props.currentConversationInfo}
        newConversationMutation={props.newConversationMutation}
      />
      <ChatbotChatBody {...props} />
    </div>
  )
}

export default ChatbotChatBox
