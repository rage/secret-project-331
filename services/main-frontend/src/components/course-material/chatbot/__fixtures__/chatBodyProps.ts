import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { v4 } from "uuid"

import type {
  ChatbotConversation,
  ChatbotConversationInfo,
  ChatbotConversationMessage,
} from "@/generated/course-material-api/types.generated"

import type { ChatbotConversationMessageWithStatus } from "../shared/ChatbotChatBody"
import type {
  ChatbotComposerValues,
  ChatbotStateAndData,
  ClientToolResponse,
} from "../shared/hooks/useChatbotStateAndData"
import { MESSAGE_FIELD } from "../shared/hooks/useChatbotStateAndData"

export const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111"
export const TIME = "2024-01-01T00:00:00.000Z"

interface ConversationMessageOverrides {
  role?: "user" | "assistant"
  text?: string
  orderNumber?: number
}

/// One finished text message, as the conversation query returns it.
export const conversationMessage = ({
  role = "assistant",
  text = "Answer",
  orderNumber = 0,
}: ConversationMessageOverrides = {}): ChatbotConversationMessage => {
  const id = v4()
  return {
    conversation_id: CONVERSATION_ID,
    created_at: TIME,
    deleted_at: null,
    id,
    message: {
      chatbot_conversation_message_id: id,
      created_at: TIME,
      deleted_at: null,
      id: v4(),
      message_is_complete: true,
      message_role: role,
      response_id: null,
      text,
      updated_at: TIME,
      used_tokens: 0,
    },
    order_number: orderNumber,
    updated_at: TIME,
  }
}

interface ChatBodyOverrides {
  /// The stored conversation. Takes precedence over `historyLength`.
  messages?: ChatbotConversationMessage[]
  /// How many stored answers to generate, numbered so a test can tell them apart.
  historyLength?: number
  /// What the reducer holds mid-stream, on top of the stored conversation.
  streamedMessages?: ChatbotConversationMessageWithStatus[]
  suggestedMessages?: { id: string; message: string }[]
  newMessage?: string
  isLoading?: boolean
  isTurnInFlight?: boolean
}

interface ChatBodyFixture {
  props: ChatbotStateAndData
  sendMessage: jest.Mock
  answer: jest.Mock
  stopTurn: jest.Mock
}

/// Props for rendering `ChatbotChatBody` on its own, with the mutations and `stopTurn` spied on.
export const makeChatBodyProps = ({
  messages,
  historyLength = 1,
  streamedMessages = [],
  suggestedMessages = [],
  newMessage = "",
  isLoading = false,
  isTurnInFlight = false,
}: ChatBodyOverrides = {}): ChatBodyFixture => {
  const answer = jest.fn()
  const stopTurn = jest.fn()

  // `useForm` only runs inside a component; `renderHook` gives it one to live in, without
  // wrapping `ChatbotChatBody` itself and disturbing its own render/remount behavior in tests.
  // The default stays "", matching production, so a mocked send's `resetField` clears the
  // field instead of reverting it to `newMessage`; `newMessage` is seeded via `setValue` instead.
  const { result } = renderHook(() => {
    const form = useForm<ChatbotComposerValues>({ defaultValues: { [MESSAGE_FIELD]: "" } })
    useEffect(() => {
      if (newMessage) {
        form.setValue(MESSAGE_FIELD, newMessage)
      }
      // oxlint-disable-next-line react/exhaustive-deps -- seeds once per fixture instance; `form` is stable
    }, [])
    return form
  })
  const composerForm = result.current

  const sendMessage = jest.fn((_message: string) => {
    composerForm.resetField(MESSAGE_FIELD)
  })

  const currentConversationInfo = {
    isLoading,
    isError: false,
    isRefetching: false,
    error: null,
    data: {
      current_conversation: { id: CONVERSATION_ID },
      current_conversation_messages:
        messages ??
        Array.from({ length: historyLength }, (_unused, index) =>
          conversationMessage({ text: `Answer ${index}`, orderNumber: index }),
        ),
      current_conversation_message_citations: [],
      hide_citations: false,
      suggested_messages: suggestedMessages,
    },
    refetch: jest.fn(),
  } as unknown as UseQueryResult<ChatbotConversationInfo, Error>

  const newConversationMutation = {
    mutate: jest.fn(),
    isPending: false,
  } as unknown as UseMutationResult<ChatbotConversation, unknown, void, unknown>

  const newMessageMutation = {
    mutate: sendMessage,
    isPending: false,
  } as unknown as UseMutationResult<void, unknown, string, unknown>

  const toolResponseMutation = {
    mutate: answer,
    isPending: false,
  } as unknown as UseMutationResult<void, unknown, ClientToolResponse, unknown>

  const props: ChatbotStateAndData = {
    currentConversationInfo,
    newConversationMutation,
    control: composerForm.control,
    submitMessage: composerForm.handleSubmit((values) => sendMessage(values.message)),
    error: null,
    messageState: { messages: streamedMessages, executionPayloadByToolCallId: {} },
    dispatch: jest.fn(),
    chatbotMessageAnnouncement: "",
    newMessageMutation,
    toolResponseMutation,
    isTurnInFlight,
    stopTurn,
  }

  return { props, sendMessage, answer, stopTurn }
}
