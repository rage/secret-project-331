"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"

import { makeChatBodyProps } from "../__fixtures__/chatBodyProps"
import ChatbotChatBody from "../shared/ChatbotChatBody"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextArea's auto-resize inside ChatbotChatBody.
beforeAll(setupIntersectionObserverMock)

const getComposer = () => screen.getByRole("textbox", { name: "label-message" })

describe("Chatbot composer", () => {
  it("exposes the message field with an accessible name", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    expect(getComposer()).toBeInTheDocument()
  })

  it("sends the typed message when Enter is pressed", async () => {
    const { props, sendMessage } = makeChatBodyProps({ newMessage: "Tell me more" })
    render(<ChatbotChatBody {...props} />)

    fireEvent.keyDown(getComposer(), { key: "Enter" })

    await waitFor(() => expect(sendMessage).toHaveBeenCalledWith("Tell me more"))
  })

  it("does not send when Shift+Enter is pressed", () => {
    const { props, sendMessage } = makeChatBodyProps({ newMessage: "Tell me more" })
    render(<ChatbotChatBody {...props} />)

    fireEvent.keyDown(getComposer(), { key: "Enter", shiftKey: true })

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("clears the message field once it has sent", async () => {
    const { props } = makeChatBodyProps({ newMessage: "Tell me more" })
    render(<ChatbotChatBody {...props} />)

    fireEvent.keyDown(getComposer(), { key: "Enter" })

    await waitFor(() => expect(getComposer()).toHaveValue(""))
  })
})
