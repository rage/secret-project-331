"use client"

import { css } from "@emotion/css"
import React from "react"

import ChatbotChatBody from "@/components/course-material/chatbot/shared/ChatbotChatBody"
import ChatbotChatHeader from "@/components/course-material/chatbot/shared/ChatbotChatHeader"
import { baseTheme } from "@/shared-module/common/styles"

interface ChatbotChatBoxProps {
  /** Leaves out the edit-chatbot menu item even for users allowed to edit, e.g. in the public embed. */
  hideEditChatbot?: boolean
}

const ChatbotChatBox: React.FC<ChatbotChatBoxProps> = ({ hideEditChatbot = false }) => {
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
      <ChatbotChatHeader isAlwaysOpen={true} hideEditChatbot={hideEditChatbot} />
      <ChatbotChatBody />
    </div>
  )
}

export default ChatbotChatBox
