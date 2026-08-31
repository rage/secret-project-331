"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"

import { conversationMessage, makeChatBodyProps } from "../__fixtures__/chatBodyProps"
import ChatbotChatBody from "../shared/ChatbotChatBody"
import MessageBubble from "../shared/MessageBubble"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextAreaField's auto-resize inside ChatbotChatBody.
beforeAll(setupIntersectionObserverMock)

const chatBodyProps = () =>
  makeChatBodyProps({
    messages: [
      conversationMessage({ role: "user", text: "Hello from me" }),
      conversationMessage({ role: "assistant", text: "Hello from the bot", orderNumber: 1 }),
    ],
  }).props

describe("Chat message sender attribution (issue #56)", () => {
  // role=generic (the bubble div) can't be named, so the label sits on the <li> instead.
  it("exposes the chatbot message listitem with an accessible name identifying the sender", () => {
    render(<ChatbotChatBody {...chatBodyProps()} />)

    const chatbotItem = screen.getByRole("listitem", { name: "message-from-chatbot" })
    expect(chatbotItem).toHaveTextContent("Hello from the bot")
  })

  it("exposes the user message listitem with a distinct accessible name", () => {
    render(<ChatbotChatBody {...chatBodyProps()} />)

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
