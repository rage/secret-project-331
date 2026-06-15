import { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

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

export interface MessageState {
  optimisticMessage: string | null
  streamingMessage: string | null
  responseStatus: ChatbotChatStreamEvent | null
}

export type MessageAction =
  | { type: "SET_OPTIMISTIC_MESSAGE"; payload: string | null }
  | { type: "APPEND_STREAMING_MESSAGE"; payload: string }
  | { type: "SET_STATUS"; payload: ChatbotChatStreamEvent | null }
  | { type: "SET_STATUS_EVENT_FINISHED"; payload: boolean }
  | { type: "RESET_MESSAGES" }

const messageReducer = (state: MessageState, action: MessageAction): MessageState => {
  switch (action.type) {
    case "SET_OPTIMISTIC_MESSAGE":
      return { ...state, optimisticMessage: action.payload }
    case "APPEND_STREAMING_MESSAGE":
      return { ...state, streamingMessage: (state.streamingMessage || "") + action.payload }
    case "SET_STATUS":
      return { ...state, responseStatus: action.payload }
    case "SET_STATUS_EVENT_FINISHED":
      if (
        state.responseStatus &&
        "data" in state.responseStatus &&
        "finished" in state.responseStatus.data &&
        (state.responseStatus.type === "Reasoning" || state.responseStatus.type === "ToolCall")
      ) {
        const responseStatus = state.responseStatus
        const responseStatusData = state.responseStatus.data satisfies { finished: boolean }
        return {
          ...state,
          responseStatus: {
            type: responseStatus.type,
            data: { ...responseStatusData, finished: action.payload },
          },
        }
      } else {
        return state
      }
    case "RESET_MESSAGES":
      return { optimisticMessage: null, streamingMessage: null, responseStatus: null }
    default:
      return state
  }
}

/// Queries, state and data needed for chatbot functionality
export interface ChatbotStateAndData {
  currentConversationInfo: UseQueryResult<ChatbotConversationInfo, Error>
  newMessage: string
  setNewMessage: React.Dispatch<React.SetStateAction<string>>
  error: unknown | null
  messageState: MessageState
  dispatch: (action: MessageAction) => void
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
  const [messageState, dispatch] = useReducer(messageReducer, {
    optimisticMessage: null,
    streamingMessage: null,
    responseStatus: null,
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
      setIsOpen?.(true)
      if (!currentConversationInfo.data?.current_conversation) {
        throw new Error("No active conversation")
      }
      setChatbotMessageAnnouncement(t("chatbot-is-responding"))
      const message = messageToSend.trim()
      dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: message })
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
              console.log(parsedValue)
              if (parsedValue.type === "Delta") {
                dispatch({ type: "APPEND_STREAMING_MESSAGE", payload: parsedValue.data.text })
              } else if (parsedValue.type === "Reasoning" || parsedValue.type === "ToolCall") {
                // todo!
                let payload: ChatbotChatStreamEvent = parsedValue
                if (parsedValue.data.finished) {
                  if (messageState.responseStatus) {
                    // ugly repetitive code to make the typescript compiler understand
                    // that this typing is valid
                    if (messageState.responseStatus.type === "Reasoning") {
                      let data = messageState.responseStatus.data
                      let type = messageState.responseStatus.type
                      data.finished = true
                      payload = { data, type }
                    } else if (messageState.responseStatus.type === "ToolCall") {
                      let data = messageState.responseStatus.data
                      let type = messageState.responseStatus.type
                      data.finished = true
                      payload = { data, type }
                    }
                  }
                }
                dispatch({ type: "SET_STATUS", payload })
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
        dispatch({ type: "RESET_MESSAGES" })
        setError(null)
        setChatbotMessageAnnouncement(t("chatbot-finished-responding"))
      },
      onError: async (error) => {
        setError(error)
        dispatch({ type: "SET_OPTIMISTIC_MESSAGE", payload: null })
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
