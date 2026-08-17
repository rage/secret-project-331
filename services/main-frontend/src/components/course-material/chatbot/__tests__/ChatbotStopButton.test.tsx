"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"

import { makeChatBodyProps } from "../__fixtures__/chatBodyProps"
import ChatbotChatBody from "../shared/ChatbotChatBody"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.

// jsdom lacks IntersectionObserver, needed by TextAreaField's auto-resize inside ChatbotChatBody.
beforeAll(setupIntersectionObserverMock)

describe("Stopping a running turn", () => {
  it("offers stopping instead of sending while a turn is in flight", () => {
    render(<ChatbotChatBody {...makeChatBodyProps({ isTurnInFlight: true }).props} />)

    expect(screen.getByRole("button", { name: "stop-generating" })).toBeEnabled()
    expect(screen.queryByRole("button", { name: "send" })).toBeNull()
  })

  it("stops the turn when the button is pressed", () => {
    const { props, stopTurn, sendMessage } = makeChatBodyProps({
      isTurnInFlight: true,
      newMessage: "Tell me more",
    })
    render(<ChatbotChatBody {...props} />)

    fireEvent.click(screen.getByRole("button", { name: "stop-generating" }))

    expect(stopTurn).toHaveBeenCalledTimes(1)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("goes back to sending once the turn has ended", () => {
    const { rerender } = render(
      <ChatbotChatBody {...makeChatBodyProps({ isTurnInFlight: true }).props} />,
    )
    const { props, stopTurn, sendMessage } = makeChatBodyProps({ newMessage: "Tell me more" })

    rerender(<ChatbotChatBody {...props} />)
    fireEvent.click(screen.getByRole("button", { name: "send" }))

    expect(screen.queryByRole("button", { name: "stop-generating" })).toBeNull()
    expect(sendMessage).toHaveBeenCalledWith("Tell me more")
    expect(stopTurn).not.toHaveBeenCalled()
  })

  it("keeps the send button disabled while there is nothing to send", () => {
    render(<ChatbotChatBody {...makeChatBodyProps().props} />)

    expect(screen.getByRole("button", { name: "send" })).toBeDisabled()
  })
})
