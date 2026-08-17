import type { ChatbotConversationMessage } from "@/generated/course-material-api/types.generated"

import type { ChatbotConversationMessageWithStatus } from "../shared/ChatbotChatBody"
import type { ChatbotStateAndData } from "../shared/hooks/useChatbotStateAndData"

export const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111"
export const TIME = "2024-01-01T00:00:00.000Z"

let idCounter = 0

/// A unique, UUID-shaped id. Avoids the uuid package, which needs jest's ESM support to import.
export const testId = (): string =>
  `${(idCounter++).toString(16).padStart(8, "0")}-1111-4111-8111-111111111111`

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
  const id = testId()
  return {
    conversation_id: CONVERSATION_ID,
    created_at: TIME,
    deleted_at: null,
    id,
    message: {
      chatbot_conversation_message_id: id,
      created_at: TIME,
      deleted_at: null,
      id: testId(),
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
  isAnsweringQuestion?: boolean
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
  isAnsweringQuestion = false,
}: ChatBodyOverrides = {}): ChatBodyFixture => {
  const sendMessage = jest.fn()
  const answer = jest.fn()
  const stopTurn = jest.fn()
  const props = {
    currentConversationInfo: {
      isLoading,
      isError: false,
      isRefetching: false,
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
    },
    newConversationMutation: { mutate: jest.fn(), isPending: false },
    newMessage,
    setNewMessage: jest.fn(),
    error: null,
    messageState: { messages: streamedMessages },
    dispatch: jest.fn(),
    chatbotMessageAnnouncement: "",
    newMessageMutation: { mutate: sendMessage, isPending: isTurnInFlight },
    toolResponseMutation: { mutate: answer, isPending: isAnsweringQuestion },
    isTurnInFlight: isTurnInFlight || isAnsweringQuestion,
    stopTurn,
  } as unknown as ChatbotStateAndData
  return { props, sendMessage, answer, stopTurn }
}
