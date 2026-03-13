"use client"

import { css } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import React from "react"

import {
  MessageAction,
  MessageState,
} from "@/components/course-material/chatbot/shared/ChatbotChat"
import ChatbotChatBody from "@/components/course-material/chatbot/shared/ChatbotChatBody"
import ChatbotChatHeader from "@/components/course-material/chatbot/shared/ChatbotChatHeader"
import { ChatbotConversation, ChatbotConversationInfo } from "@/shared-module/common/bindings"
import { baseTheme } from "@/shared-module/common/styles"

export interface ChatbotChatBoxProps {
  chatbotConfigurationId: string
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  messageState: MessageState
  dispatch: (action: MessageAction) => void
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: Error | null
  setError: (value: React.SetStateAction<Error | null>) => void
  chatbotMessageAnnouncement: string
  newMessageMutation: UseMutationResult<
    ReadableStream<Uint8Array<ArrayBufferLike>>,
    unknown,
    string,
    unknown
  >
  newConversation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
}

const ChatbotChatBox: React.FC<ChatbotChatBoxProps> = (props) => {
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
        chatbotConfigurationId={props.chatbotConfigurationId}
        currentConversationInfo={props.currentConversationInfo}
        newConversation={props.newConversation}
      />
      <ChatbotChatBody {...props} />
    </div>
  )
}

export default ChatbotChatBox
