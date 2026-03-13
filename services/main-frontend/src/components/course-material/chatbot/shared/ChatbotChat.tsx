"use client"

import { useSetAtom } from "jotai"
import React, { useEffect, useReducer, useRef, useState } from "react"
import { useOverlayTrigger } from "react-aria"
import { useTranslation } from "react-i18next"

import ChatbotChatBox from "../../ContentRenderer/moocfi/ChatbotBlock/ChatbotChatBox"
import ChatbotDialog from "../Chatbot/ChatbotDialog"
import OpenChatbotButton from "../Chatbot/OpenChatbotButton"

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

export type ChatbotState = {
  isOpen: boolean
  setOpen: (o: boolean) => void
  open: () => void
  close: () => void
  toggle: () => void
}

const ChatbotChat: React.FC<ChatbotChatProps> = ({
  chatbotConfigurationId,
  isCourseMaterialBlock,
}) => {
  const { t } = useTranslation()
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [newMessage, setNewMessage] = React.useState("")
  const [error, setError] = useState<Error | null>(null)
  const [shouldRender, setShouldRender] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  let state: ChatbotState = {
    isOpen,
    setOpen: (o: boolean) => {
      setIsOpen(o)
      if (!o) {
        buttonRef.current?.focus()
      }
    },
    open: () => {
      setIsOpen(true)
    },
    close: () => {
      // no operation prevents close on scroll
    },
    toggle: () => {
      setIsOpen(!isOpen)
      if (isOpen) {
        buttonRef.current?.focus()
      }
    },
  }
  let { triggerProps, overlayProps } = useOverlayTrigger({ type: "dialog" }, state, buttonRef)

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
      if (!isCourseMaterialBlock && !state.isOpen) {
        state.open()
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
      return () => setSendNewMessage(null)
    }
  })

  return (
    <>
      {!isCourseMaterialBlock && (
        <>
          <OpenChatbotButton hide={shouldRender} triggerProps={triggerProps} ref={buttonRef} />
          <ChatbotDialog
            currentConversationInfo={currentConversationInfoQuery}
            state={state}
            buttonRef={buttonRef}
            shouldRender={shouldRender}
            setShouldRender={setShouldRender}
            messageState={messageState}
            dispatch={dispatch}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            error={error}
            setError={setError}
            overlayProps={overlayProps}
            chatbotMessageAnnouncement={chatbotMessageAnnouncement}
            newMessageMutation={newMessageMutation}
            newConversation={newConversationMutation}
          />
        </>
      )}
      {isCourseMaterialBlock && (
        <ChatbotChatBox
          currentConversationInfo={currentConversationInfoQuery}
          messageState={messageState}
          dispatch={dispatch}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          error={error}
          chatbotMessageAnnouncement={chatbotMessageAnnouncement}
          newMessageMutation={newMessageMutation}
          newConversation={newConversationMutation}
        />
      )}
    </>
  )
}

export default ChatbotChat
