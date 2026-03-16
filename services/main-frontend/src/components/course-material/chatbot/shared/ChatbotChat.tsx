"use client"

import { useSetAtom } from "jotai"
import React, { useEffect, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import ChatbotChatBox from "../../ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import ChatbotDialog from "../Chatbot/ChatbotDialog"

import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import { sendChatbotMessage } from "@/services/course-material/backend"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { defaultChatbotCommunicationChannel } from "@/stores/course-material/chatbotDialogStore"

interface ChatbotChatProps {
  chatbotConfigurationId: string
  isCourseMaterialBlock: boolean
}

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

const ChatbotChat: React.FC<ChatbotChatProps> = ({
  chatbotConfigurationId,
  isCourseMaterialBlock,
}) => {
  const { t } = useTranslation()
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [newMessage, setNewMessage] = React.useState("")
  const [error, setError] = useState<Error | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const [messageState, dispatch] = useReducer(messageReducer, {
    optimisticMessage: null,
    streamingMessage: null,
  })

  const setDefaultChatbotCommunicationChannel = useSetAtom(defaultChatbotCommunicationChannel)

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
      if (!isCourseMaterialBlock && !isOpen) {
        setIsOpen(true)
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

  const mutateAsync = newMessageMutation.mutateAsync

  useEffect(() => {
    if (!isCourseMaterialBlock) {
      setDefaultChatbotCommunicationChannel({
        sendNewMessage: async (message) => {
          await mutateAsync(message)
        },
      })
      return () => setDefaultChatbotCommunicationChannel(null)
    }
  }, [isCourseMaterialBlock, setDefaultChatbotCommunicationChannel, mutateAsync])

  return (
    <>
      {isCourseMaterialBlock && (
        <ChatbotChatBox
          chatbotMessageAnnouncement={chatbotMessageAnnouncement}
          currentConversationInfo={currentConversationInfoQuery}
          dispatch={dispatch}
          error={error}
          messageState={messageState}
          newConversation={newConversationMutation}
          newMessage={newMessage}
          newMessageMutation={newMessageMutation}
          setNewMessage={setNewMessage}
        />
      )}
      {!isCourseMaterialBlock && (
        <ChatbotDialog
          chatbotMessageAnnouncement={chatbotMessageAnnouncement}
          currentConversationInfo={currentConversationInfoQuery}
          dispatch={dispatch}
          error={error}
          isOpen={isOpen}
          messageState={messageState}
          newConversation={newConversationMutation}
          newMessage={newMessage}
          newMessageMutation={newMessageMutation}
          setIsOpen={setIsOpen}
          setNewMessage={setNewMessage}
        />
      )}
    </>
  )
}

export default ChatbotChat
