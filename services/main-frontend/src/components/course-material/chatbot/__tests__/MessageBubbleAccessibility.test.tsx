"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import ChatbotChatBody from "../shared/ChatbotChatBody"
import MessageBubble from "../shared/MessageBubble"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextAreaField's auto-resize inside ChatbotChatBody.
beforeAll(() => {
  class IntersectionObserverStub {
    public observe() {}
    public unobserve() {}
    public disconnect() {}
    public takeRecords() {
      return []
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).IntersectionObserver = IntersectionObserverStub
})

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111"

const makeConversationMessage = (
  id: string,
  messageId: string,
  role: "user" | "assistant",
  text: string,
) => ({
  conversation_id: CONVERSATION_ID,
  created_at: "2024-01-01T00:00:00.000Z",
  id,
  message: {
    chatbot_conversation_message_id: id,
    created_at: "2024-01-01T00:00:00.000Z",
    id: messageId,
    message_is_complete: true,
    message_role: role,
    text,
    updated_at: "2024-01-01T00:00:00.000Z",
    used_tokens: 0,
  },
  order_number: 0,
  updated_at: "2024-01-01T00:00:00.000Z",
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeChatBodyProps = (): any => ({
  currentConversationInfo: {
    isLoading: false,
    isError: false,
    isRefetching: false,
    data: {
      current_conversation: { id: CONVERSATION_ID },
      current_conversation_messages: [
        makeConversationMessage(
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
          "user",
          "Hello from me",
        ),
        makeConversationMessage(
          "44444444-4444-4444-8444-444444444444",
          "55555555-5555-4555-8555-555555555555",
          "assistant",
          "Hello from the bot",
        ),
      ],
      current_conversation_message_citations: [],
      hide_citations: false,
      suggested_messages: [],
    },
  },
  newConversationMutation: { mutate: jest.fn(), isPending: false },
  newMessage: "",
  setNewMessage: jest.fn(),
  error: null,
  messageState: { messages: [] },
  dispatch: jest.fn(),
  chatbotMessageAnnouncement: "",
  newMessageMutation: { mutate: jest.fn(), isPending: false },
})

describe("Chat message sender attribution (issue #56)", () => {
  // role=generic (the bubble div) can't be named, so the label sits on the <li> instead.
  it("exposes the chatbot message listitem with an accessible name identifying the sender", () => {
    render(<ChatbotChatBody {...makeChatBodyProps()} />)

    const chatbotItem = screen.getByRole("listitem", { name: "message-from-chatbot" })
    expect(chatbotItem).toHaveTextContent("Hello from the bot")
  })

  it("exposes the user message listitem with a distinct accessible name", () => {
    render(<ChatbotChatBody {...makeChatBodyProps()} />)

    const userItem = screen.getByRole("listitem", { name: "message-from-you" })
    expect(userItem).toHaveTextContent("Hello from me")
    expect(userItem).not.toBe(screen.getByRole("listitem", { name: "message-from-chatbot" }))
  })

  it("does not put a prohibited aria-label on the bubble div itself", () => {
    const { container } = render(
      <MessageBubble
        message="Hello from the bot"
        isFromChatbot={true}
        isPending={false}
        citations={undefined}
      />,
    )

    // role=generic prohibits accessible naming, so the bubble itself must stay label-free.
    expect(container.querySelector("[aria-label]")).toBeNull()
  })
})
