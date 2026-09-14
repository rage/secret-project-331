"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

import { client as courseMaterialClient } from "@/generated/course-material-api/client.generated"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"

import { hasStreamedAssistantContent } from "../../chatbotReducer"
import {
  ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
  multipleChoiceAnswer,
} from "../../multipleChoiceQuestions"
import useChatbotStateAndData from "../useChatbotStateAndData"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

jest.mock("@/generated/course-material-api/client.generated", () => ({
  client: { post: jest.fn() },
}))
jest.mock("@/hooks/course-material/chatbot/useCurrentConversationInfo", () => ({
  __esModule: true,
  default: jest.fn(),
}))
jest.mock("@/hooks/course-material/chatbot/newConversationMutation", () => ({
  __esModule: true,
  default: () => ({ mutate: jest.fn(), isPending: false }),
}))

const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222"

const post = courseMaterialClient.post as unknown as jest.Mock
const currentConversationInfo = useCurrentConversationInfo as unknown as jest.Mock

/** Makes `post` hang forever, so nothing about the assertions below can depend on it resolving. */
const postForever = () => {
  post.mockImplementation(() => new Promise(() => {}))
}

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const renderChatbot = () =>
  renderHook(
    () => useChatbotStateAndData("11111111-1111-4111-8111-111111111111", undefined, null),
    {
      wrapper,
    },
  )

beforeEach(() => {
  jest.clearAllMocks()
  currentConversationInfo.mockReturnValue({
    data: {
      current_conversation: { id: CONVERSATION_ID },
      current_conversation_messages: [],
    },
    refetch: jest.fn().mockResolvedValue({ data: { current_conversation_messages: [] } }),
  })
})

describe("What ChatbotChatBody's status row reads right after sending", () => {
  // The status row shows when isTurnInFlight is true and
  // hasStreamedAssistantContent(messageState.messages) is false. `post` never resolves, so
  // waitFor can only see this become true from mutate()'s synchronous setup — never from a
  // network reply.
  it("is turn-in-flight with no streamed content yet, before the network can have replied", async () => {
    postForever()
    const { result } = renderChatbot()

    act(() => {
      result.current.newMessageMutation.mutate("Tell me about loops")
    })

    await waitFor(() => expect(result.current.isTurnInFlight).toBe(true))
    expect(hasStreamedAssistantContent(result.current.messageState.messages)).toBe(false)
  })

  it("is the same for answering a client tool's question", async () => {
    postForever()
    const { result } = renderChatbot()

    act(() => {
      result.current.toolResponseMutation.mutate({
        toolCallId: "33333333-3333-4333-8333-333333333333",
        toolName: ASK_MULTIPLE_CHOICE_QUESTION_TOOL,
        answer: multipleChoiceAnswer(0),
      })
    })

    await waitFor(() => expect(result.current.isTurnInFlight).toBe(true))
    expect(hasStreamedAssistantContent(result.current.messageState.messages)).toBe(false)
  })
})
