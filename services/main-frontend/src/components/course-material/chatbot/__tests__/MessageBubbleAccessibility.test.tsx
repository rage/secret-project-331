"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import MessageBubble from "../shared/MessageBubble"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("MessageBubble accessibility (issue #56)", () => {
  it("labels a chatbot message so screen readers can tell who sent it", () => {
    render(
      <MessageBubble
        message="Hello from the bot"
        isFromChatbot={true}
        isPending={false}
        citations={undefined}
      />,
    )
    expect(screen.getByLabelText("message-from-chatbot")).toBeInTheDocument()
  })

  it("labels a user message distinctly from a chatbot message", () => {
    render(
      <MessageBubble
        message="Hello from me"
        isFromChatbot={false}
        isPending={false}
        citations={undefined}
      />,
    )
    expect(screen.getByLabelText("message-from-you")).toBeInTheDocument()
    expect(screen.queryByLabelText("message-from-chatbot")).not.toBeInTheDocument()
  })
})
