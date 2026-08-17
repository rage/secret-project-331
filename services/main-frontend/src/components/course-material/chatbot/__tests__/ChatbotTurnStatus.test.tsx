"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"

import { CONVERSATION_ID, makeChatBodyProps, TIME } from "../__fixtures__/chatBodyProps"
import type { ChatbotConversationMessageWithStatus } from "../shared/ChatbotChatBody"
import ChatbotChatBody from "../shared/ChatbotChatBody"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextAreaField's auto-resize inside ChatbotChatBody.
beforeAll(setupIntersectionObserverMock)

/// A reasoning item as the reducer holds it mid-stream, before its finished event arrives.
const unfinishedReasoningItem = (): ChatbotConversationMessageWithStatus =>
  ({
    finished: false,
    optimistic: true,
    message: {
      conversation_id: CONVERSATION_ID,
      created_at: TIME,
      id: "66666666-6666-4666-8666-666666666666",
      message: {
        chatbot_conversation_message_id: "66666666-6666-4666-8666-666666666666",
        created_at: TIME,
        id: "77777777-7777-4777-8777-777777777777",
        reasoning_id: "rs_1",
        response_id: "resp_1",
        updated_at: TIME,
      },
      order_number: 1,
      updated_at: TIME,
    },
  }) as unknown as ChatbotConversationMessageWithStatus

describe("Turn status while the chatbot answers", () => {
  // A bare div here is an axe `list` violation, because the row's parent is the message <ul>.
  it("renders the status row as a list item", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ isTurnInFlight: true }).props} />)

    const rows = screen.getAllByRole("listitem")
    expect(rows.some((row) => row.textContent === "chatbot-status-thinking")).toBe(true)
  })

  it("drops the status row once no turn is in flight", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    expect(screen.queryByText("chatbot-status-thinking")).toBeNull()
  })

  it("marks the message list busy only while a turn is in flight", () => {
    const { rerender } = render(
      <ChatbotChatBody {...makeChatBodyProps({ isTurnInFlight: true }).props} />,
    )

    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "true")

    rerender(<ChatbotChatBody {...makeChatBodyProps().props} />)
    expect(screen.getByRole("list")).toHaveAttribute("aria-busy", "false")
  })
})

describe("Streamed tool call and reasoning items", () => {
  it("reports an unfinished item as in progress while its turn is still running", () => {
    render(
      <ChatbotChatBody
        {...makeChatBodyProps({
          isTurnInFlight: true,
          streamedMessages: [unfinishedReasoningItem()],
        }).props}
      />,
    )

    expect(screen.getByText("chatbot-status-thinking")).toBeInTheDocument()
  })

  // An `Error` event, or a stream closing without its finished event, strands an item unfinished,
  // and the item stays on screen until the refetch replaces it.
  it("stops reporting an unfinished item as in progress once its turn has ended", () => {
    render(
      <ChatbotChatBody
        {...makeChatBodyProps({ streamedMessages: [unfinishedReasoningItem()] }).props}
      />,
    )

    expect(screen.queryByText("chatbot-status-thinking")).toBeNull()
    expect(screen.getByText("chatbot-status-thinking-finished")).toBeInTheDocument()
  })
})

describe("Chatbot status live region", () => {
  it("keeps one live region node across a change of view state", () => {
    const { rerender } = render(
      <ChatbotChatBody {...makeChatBodyProps({ isLoading: true }).props} />,
    )

    const whileLoading = screen.getByRole("status")

    rerender(<ChatbotChatBody {...makeChatBodyProps().props} />)
    expect(screen.getByRole("status")).toBe(whileLoading)
  })
})

describe("Following the newest message", () => {
  const SCROLL_HEIGHT = 1000
  const CLIENT_HEIGHT = 200

  let setScrollTop: jest.Mock

  beforeEach(() => {
    setScrollTop = jest.fn()
    jest.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(SCROLL_HEIGHT)
    jest.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(CLIENT_HEIGHT)
    jest.spyOn(Element.prototype, "scrollTop", "get").mockReturnValue(0)
    jest.spyOn(Element.prototype, "scrollTop", "set").mockImplementation(setScrollTop)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("scrolls to the newest message when a scrollable conversation is first shown", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ historyLength: 20 }).props} />)

    expect(setScrollTop).toHaveBeenCalledWith(SCROLL_HEIGHT)
  })

  // The mocked heights stand for content already in the DOM, so the distance to the bottom reads as
  // huge. Only what the learner did may decide whether to follow.
  it("keeps following new output for a learner who has not scrolled", () => {
    const { rerender } = render(
      <ChatbotChatBody {...makeChatBodyProps({ historyLength: 20 }).props} />,
    )
    setScrollTop.mockClear()

    rerender(<ChatbotChatBody {...makeChatBodyProps({ historyLength: 21 }).props} />)

    expect(setScrollTop).toHaveBeenCalledWith(SCROLL_HEIGHT)
  })

  it("stops following once the learner has scrolled away from the bottom", () => {
    const { rerender } = render(
      <ChatbotChatBody {...makeChatBodyProps({ historyLength: 20 }).props} />,
    )
    fireEvent.scroll(screen.getByRole("list"))
    setScrollTop.mockClear()

    rerender(<ChatbotChatBody {...makeChatBodyProps({ historyLength: 21 }).props} />)

    expect(setScrollTop).not.toHaveBeenCalled()
  })
})
