"use client"

import { css } from "@emotion/css"
import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import React, { DOMAttributes } from "react"

import { MessageAction, MessageState } from "../Chatbot/ChatbotDialog"
import ChatbotChatBody from "../shared/ChatbotChatBody"
import ChatbotChatHeader from "../shared/ChatbotChatHeader"

import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import { ChatbotConversationInfo } from "@/shared-module/common/bindings"

interface ChatbotDialogProps {
  chatbotConfigurationId: string
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: Error | null
  setError: (value: React.SetStateAction<Error | null>) => void
  closeChatbot: () => void
  isCourseMaterialBlock: false
  titleProps: DOMAttributes<Element>
  messageState: MessageState
  chatbotMessageAnnouncement: string
  dispatch: React.ActionDispatch<[action: MessageAction]>
  newMessageMutation: UseMutationResult<
    ReadableStream<Uint8Array<ArrayBufferLike>>,
    unknown,
    string,
    unknown
  >
}

interface ChatbotNoDialogProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: true
}

export type DiscrChatbotDialogProps = ChatbotDialogProps | ChatbotNoDialogProps

const ChatbotChat: React.FC<ChatbotDialogProps> = (props) => {
  const { chatbotConfigurationId, currentConversationInfo, setNewMessage, setError } = props

  const newConversationMutation = useNewConversationMutation(
    chatbotConfigurationId,
    currentConversationInfo,
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
        newConversation={newConversationMutation}
        isCourseMaterialBlock={false}
      />
      <ChatbotChatBody {...props} newConversation={newConversationMutation} />
    </div>
  )
}

export default ChatbotChat
