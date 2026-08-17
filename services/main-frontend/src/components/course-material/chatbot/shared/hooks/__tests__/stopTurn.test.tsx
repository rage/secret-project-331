"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"

import { client as courseMaterialClient } from "@/generated/course-material-api/client.generated"
import useCurrentConversationInfo from "@/hooks/course-material/chatbot/useCurrentConversationInfo"
import { includeIf } from "@/shared-module/common/utils/nullability"

import { streamOf } from "../../../__fixtures__/chatbotResponseStream"
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

const CONFIGURATION_ID = "11111111-1111-4111-8111-111111111111"
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222"
const TOOL_CALL_ID = "33333333-3333-4333-8333-333333333333"

const post = courseMaterialClient.post as unknown as jest.Mock
const currentConversationInfo = useCurrentConversationInfo as unknown as jest.Mock

/** A stream that ends at once, standing for a turn the server finished on its own. */
const emptyStream = () => streamOf([]).stream

/** Makes `post` hang until the request it was given is aborted, as a streaming turn does. */
const postUntilAborted = () => {
  post.mockImplementation(
    ({ signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError")),
        )
      }),
  )
}

/**
 * Makes `post` hang, as a turn the server is still streaming. The returned call ends the stream and
 * settles once the turn has read it, whether or not anything is still mounted to await it.
 */
const postUntilFinished = () => {
  let finish: (() => void) | undefined
  let sent: Promise<unknown> = Promise.resolve()
  post.mockImplementation(() => {
    sent = new Promise((resolve) => {
      finish = () => resolve(emptyStream())
    })
    return sent
  })
  return async () => {
    finish?.()
    await sent
  }
}

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const renderChatbot = () =>
  renderHook(() => useChatbotStateAndData(CONFIGURATION_ID, undefined, "course_material_dialog"), {
    wrapper,
  })

/** The signal the pending turn was sent with, once the request has gone out. */
const sentSignal = async (): Promise<AbortSignal> => {
  await waitFor(() => expect(post).toHaveBeenCalled())
  return post.mock.calls[0][0].signal
}

/** Mocks the conversation query. With no conversation a turn throws before its request goes out. */
const mockConversationInfo = ({ hasConversation }: { hasConversation: boolean }) => {
  const refetch = jest.fn().mockResolvedValue({ data: { current_conversation_messages: [] } })
  currentConversationInfo.mockReturnValue({
    data: {
      ...includeIf(hasConversation, { current_conversation: { id: CONVERSATION_ID } }),
      current_conversation_messages: [],
    },
    refetch,
  })
  return refetch
}

/** Refetched whenever a turn settles, so it shows the hook still acting on a finished turn. */
let refetchConversationInfo: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  refetchConversationInfo = mockConversationInfo({ hasConversation: true })
})

describe("Starting a chatbot turn", () => {
  // Settling the second turn would wipe the first one's streamed messages mid-stream.
  it("refuses a second turn while one is still streaming", async () => {
    postUntilAborted()
    const { result } = renderChatbot()
    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))
    const signal = await sentSignal()

    act(() => result.current.newMessageMutation.mutate("And about recursion"))

    // The observer follows the refused turn, so its own state stops describing the running one.
    await waitFor(() => expect(result.current.newMessageMutation.isError).toBe(true))
    expect(post).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBeNull()
    expect(result.current.chatbotMessageAnnouncement).toBe("chatbot-is-responding")
    // The turn kept streaming, so the chat still has to show it, and Stop still has to reach it.
    expect(result.current.isTurnInFlight).toBe(true)
    act(() => result.current.stopTurn())
    expect(signal.aborted).toBe(true)
  })

  it("ends a turn that threw before its request went out", async () => {
    mockConversationInfo({ hasConversation: false })
    post.mockResolvedValue(emptyStream())
    const { result, rerender } = renderChatbot()

    await act(async () => {
      await expect(
        result.current.newMessageMutation.mutateAsync("Tell me about loops"),
      ).rejects.toThrow("No active conversation")
    })

    expect(result.current.isTurnInFlight).toBe(false)
    mockConversationInfo({ hasConversation: true })
    rerender()
    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  })

  it("runs an answer to a question as a turn like any other", async () => {
    postUntilAborted()
    const { result } = renderChatbot()

    act(() =>
      result.current.toolResponseMutation.mutate({ toolCallId: TOOL_CALL_ID, choiceIndex: 0 }),
    )

    const signal = await sentSignal()
    expect(result.current.isTurnInFlight).toBe(true)
    act(() => result.current.stopTurn())
    expect(signal.aborted).toBe(true)
    await waitFor(() => expect(result.current.isTurnInFlight).toBe(false))
    // The answer released the turn, so the learner can go on writing to the chatbot.
    post.mockResolvedValue(emptyStream())
    act(() => result.current.newMessageMutation.mutate("Tell me more"))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2))
  })
})

describe("Stopping a chatbot turn", () => {
  it("aborts the request the running turn was sent with", async () => {
    postUntilAborted()
    const { result } = renderChatbot()
    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))
    const signal = await sentSignal()

    act(() => result.current.stopTurn())

    expect(signal.aborted).toBe(true)
  })

  it("settles the conversation without an error when the learner stops the turn", async () => {
    postUntilAborted()
    const { result } = renderChatbot()
    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))
    await sentSignal()

    act(() => result.current.stopTurn())

    await waitFor(() =>
      expect(result.current.chatbotMessageAnnouncement).toBe("chatbot-stopped-responding"),
    )
    expect(result.current.error).toBeNull()
  })

  it("still reports a turn that failed on its own", async () => {
    post.mockRejectedValue(new Error("Bad gateway"))
    const { result } = renderChatbot()

    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))

    await waitFor(() =>
      expect(result.current.chatbotMessageAnnouncement).toBe("failed-to-send-message"),
    )
    expect(result.current.error).toBeInstanceOf(Error)
  })

  // The server persists the answer as it streams and cuts it short when the request goes away, so
  // a learner who navigates away mid-turn has to come back to a whole answer.
  it("leaves the turn to the server when the chatbot unmounts, and stops acting on it", async () => {
    const finishTurn = postUntilFinished()
    const errorGroup = jest.spyOn(console, "groupCollapsed").mockImplementation(() => {})
    const { result, unmount } = renderChatbot()
    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))
    const signal = await sentSignal()

    unmount()
    await act(async () => {
      await finishTurn()
    })

    expect(signal.aborted).toBe(false)
    expect(refetchConversationInfo).not.toHaveBeenCalled()
    expect(errorGroup).not.toHaveBeenCalled()
    errorGroup.mockRestore()
  })

  it("leaves nothing to abort once the turn has finished", async () => {
    post.mockResolvedValue(emptyStream())
    const { result } = renderChatbot()
    act(() => result.current.newMessageMutation.mutate("Tell me about loops"))
    const signal = await sentSignal()
    await waitFor(() =>
      expect(result.current.chatbotMessageAnnouncement).toBe("chatbot-finished-responding"),
    )

    act(() => result.current.stopTurn())

    expect(signal.aborted).toBe(false)
  })
})
