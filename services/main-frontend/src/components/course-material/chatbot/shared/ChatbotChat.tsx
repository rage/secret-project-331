"use client"

import { css } from "@emotion/css"
import { useSetAtom } from "jotai"
import React, { DOMAttributes, useEffect, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import { ChatbotState } from "../Chatbot/ChatbotDialog"

import ChatbotChatBody from "./ChatbotChatBody"
import ChatbotChatHeader from "./ChatbotChatHeader"

import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import { sendChatbotMessage } from "@/services/course-material/backend"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { defaultChatbotCommunicationChannel } from "@/stores/course-material/chatbotDialogStore"

interface ChatbotDialogProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: false
  state: ChatbotState
  titleProps: DOMAttributes<Element>
}

interface ChatbotNoDialogProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: true
}

export type DiscrChatbotDialogProps = ChatbotDialogProps | ChatbotNoDialogProps

export interface MessageState {
  optimisticMessage: string | null
  streamingMessage: string | null
}

export type MessageAction =
  | { type: "SET_OPTIMISTIC_MESSAGE"; payload: string | null }
  | { type: "APPEND_STREAMING_MESSAGE"; payload: string }
  | { type: "RESET_MESSAGES" }

const messageReducer = (state: MessageState, action: MessageAction): MessageState => {
  switch (action.type) {
    case "SET_OPTIMISTIC_MESSAGE":
      return { ...state, optimisticMessage: action.payload }
    case "APPEND_STREAMING_MESSAGE":
      return { ...state, streamingMessage: (state.streamingMessage || "") + action.payload }
    case "RESET_MESSAGES":
      return { optimisticMessage: null, streamingMessage: null }
    default:
      return state
  }
}

const ChatbotChat: React.FC<DiscrChatbotDialogProps> = (props) => {
  const { chatbotConfigurationId, isCourseMaterialBlock } = props
  const { t } = useTranslation()

  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [newMessage, setNewMessage] = React.useState("")
  const [error, setError] = useState<Error | null>(null)

  const [messageState, dispatch] = useReducer(messageReducer, {
    optimisticMessage: null,
    streamingMessage: null,
  })

  const setSendNewMessage = useSetAtom(defaultChatbotCommunicationChannel)

  const currentConversationInfoQuery = useCurrentConversationInfo(chatbotConfigurationId)

  const newConversationMutation = useNewConversationMutation(
    chatbotConfigurationId,
    currentConversationInfoQuery,
    setNewMessage,
    setError,
  )

  const newMessageMutation = useToastMutation(
    async (messageToSend: string) => {
      setChatbotMessageAnnouncement("")
      if (!isCourseMaterialBlock && !props.state.isOpen) {
        props.state.open()
      }
      if (!currentConversationInfoQuery.data?.current_conversation) {
        throw new Error("No active conversation")
      }
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      const message = messageToSend.trim()
      dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: message })
      setNewMessage("")
      const stream = await sendChatbotMessage(
        chatbotConfigurationId,
        currentConversationInfoQuery.data.current_conversation.id,
        message,
      )
      const reader = stream.getReader()

      let done = false
      while (!done) {
        const { done: doneReading, value } = await reader.read()
        done = doneReading
        if (value) {
          const valueAsString = new TextDecoder().decode(value)
          const lines = valueAsString.split("\n")
          for (const line of lines) {
            if (line?.indexOf("{") !== 0) {
              continue
            }
            try {
              const parsedValue = JSON.parse(line)
              if (parsedValue.text) {
                dispatch({ type: "APPEND_STREAMING_MESSAGE", payload: parsedValue.text })
              }
            } catch (e) {
              console.error(e)
            }
          }
        }
      }
      return stream
    },
    { notify: false },
    {
      onSuccess: async () => {
        await currentConversationInfoQuery.refetch()
        dispatch({ type: "RESET_MESSAGES" })
        setError(null)
        setChatbotMessageAnnouncement(t("chatbot-finished-responding"))
      },
      onError: async (error) => {
        if (error instanceof Error) {
          setError(error)
          dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: null })
        } else {
          console.error(`Failed to send chat message: ${error}`)
          setError(new Error("Unknown error occurred"))
        }
        await currentConversationInfoQuery.refetch()
      },
    },
  )

  useEffect(() => {
    if (!isCourseMaterialBlock) {
      setSendNewMessage({
        newMessageMutation: newMessageMutation,
      })
    }
    return () => setSendNewMessage(null)
  })

  const chatbotTitleProps = isCourseMaterialBlock
    ? { ...props }
    : { ...props, closeChatbot: () => props.state.setOpen(false) }

  return (
    <div
      // remove this style?
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
        {...chatbotTitleProps}
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
      />
      <ChatbotChatBody
        currentConversationInfo={currentConversationInfoQuery}
        newConversation={newConversationMutation}
        newMessage={newMessage}
        setNewMessage={setNewMessage}
        error={error}
        chatbotMessageAnnouncement={chatbotMessageAnnouncement}
        dispatch={dispatch}
        messageState={messageState}
        newMessageMutation={newMessageMutation}
      />
    </div>
  )
}

export default ChatbotChat
