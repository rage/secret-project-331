import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import type { ChatbotAction, ChatbotState } from "../chatbotReducer"
import chatbotReducer from "../chatbotReducer"

import { client as courseMaterialClient } from "@/generated/course-material-api/client.generated"
import type {
  ChatbotChatStreamEvent,
  ChatbotConversation,
  ChatbotConversationInfo,
  SendChatbotMessageData,
} from "@/generated/course-material-api/types.generated"
import useNewConversationMutation from "@/hooks/course-material/chatbot/newConversationMutation"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"

const SEND_CHATBOT_MESSAGE_PATH: SendChatbotMessageData["url"] =
  "/api/v0/course-material/chatbot/{chatbot_configuration_id}/conversations/{conversation_id}/send-message"

/// Queries, state and data needed for chatbot functionality
export interface ChatbotStateAndData {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: unknown | null
  messageState: ChatbotState
  dispatch: (action: ChatbotAction) => void
  newConversationMutation: UseMutationResult<ChatbotConversation, unknown, void, unknown>
  chatbotMessageAnnouncement: string
  newMessageMutation: UseMutationResult<
    ReadableStream<Uint8Array<ArrayBufferLike>>,
    unknown,
    string,
    unknown
  >
}

const useChatbotStateAndData = (
  chatbotConfigurationId: string,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>> | undefined,
) => {
  const { t } = useTranslation()
  const [newMessage, setNewMessage] = useState("")
  const [error, setError] = useState<unknown | null>(null)
  const [chatbotMessageAnnouncement, setChatbotMessageAnnouncement] = useState<string>("")
  const [messageState, dispatch] = useReducer(chatbotReducer, {
    messages: [],
  })

  const currentConversationInfo = useCurrentConversationInfo(chatbotConfigurationId)
  const newConversationMutation = useNewConversationMutation(
    chatbotConfigurationId,
    currentConversationInfo,
    setNewMessage,
    setError,
  )
  const newMessageMutation = useToastMutation(
    async (messageToSend: string) => {
      setChatbotMessageAnnouncement("")
      setError(null)
      setIsOpen?.(true)
      if (!currentConversationInfo.data?.current_conversation) {
        throw new Error("No active conversation")
      }
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      const message = messageToSend.trim()
      dispatch({ type: "USER_SENDS_MESSAGE", payload: message })
      setNewMessage("")
      const stream = await courseMaterialClient.post<
        ReadableStream<Uint8Array>,
        unknown,
        true,
        "data"
      >({
        body: message,
        parseAs: "stream",
        path: {
          chatbot_configuration_id: chatbotConfigurationId,
          conversation_id: currentConversationInfo.data.current_conversation.id,
        },
        responseStyle: "data",
        url: SEND_CHATBOT_MESSAGE_PATH,
      })
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
              const parsedValue: ChatbotChatStreamEvent = JSON.parse(line)
              if (parsedValue.type === "Delta") {
                dispatch({
                  type: "RECEIVED_TEXT_DELTA",
                  payload: { text: parsedValue.data.text, message_id: parsedValue.data.message_id },
                })
              } else if (parsedValue.type === "Reasoning") {
                if (parsedValue.data.finished) {
                  dispatch({
                    type: "REASONING_FINISHED",
                    payload: { reasoning_id: parsedValue.data.reasoning_id },
                  })
                } else {
                  dispatch({
                    type: "REASONING_IN_PROGRESS",
                    payload: { reasoning_id: parsedValue.data.reasoning_id },
                  })
                }
              } else if (parsedValue.type === "ToolCall") {
                if (parsedValue.data.finished) {
                  dispatch({
                    type: "TOOL_CALL_FINISHED",
                    payload: { tool_call_id: parsedValue.data.tool_call_id },
                  })
                } else {
                  dispatch({ type: "TOOL_CALL_IN_PROGRESS", payload: { ...parsedValue.data } })
                }
              } else if (parsedValue.type === "Error") {
                setError(parsedValue.data)
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
        await currentConversationInfo.refetch()
        dispatch({ type: "RESPONSE_COMPLETED" })
        setChatbotMessageAnnouncement(t("chatbot-finished-responding"))
      },
      onError: async (error) => {
        setError(error)
        dispatch({ type: "RESPONSE_COMPLETED" })
        await currentConversationInfo.refetch()
      },
    },
  )
  return {
    newConversationMutation,
    newMessageMutation,
    currentConversationInfo,
    newMessage,
    setNewMessage,
    messageState,
    dispatch,
    error,
    chatbotMessageAnnouncement,
  }
}

export default useChatbotStateAndData
