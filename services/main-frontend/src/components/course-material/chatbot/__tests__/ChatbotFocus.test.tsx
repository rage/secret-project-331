"use client"

import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"

import ChatbotDialog from "../Chatbot/ChatbotDialog"
import ChatbotDisclaimer from "../shared/ChatbotDisclaimer"

jest.mock("../shared/ChatbotContext", () => ({
  useChatbotContext: () => {
    const [isOpen, setIsOpen] = useState(false)
    return { isOpen, setDialogOpen: setIsOpen }
  },
}))
jest.mock("../shared/ChatbotChatHeader", () => ({
  __esModule: true,
  default: ({ titleProps, closeChatbot }: { titleProps: object; closeChatbot: () => void }) => (
    <div>
      <h3 {...titleProps}>Py Helper</h3>
      <button onClick={closeChatbot}>close</button>
    </div>
  ),
}))
jest.mock("../shared/ChatbotChatBody", () => ({ __esModule: true, default: () => <p>body</p> }))

describe("chatbot dialog focus (B-014)", () => {
  it("moves focus into the dialog on open and back to the trigger on Escape", async () => {
    render(<ChatbotDialog />)
    const trigger = screen.getByRole("button", { name: "open-chatbot" })

    act(() => {
      fireEvent.click(trigger)
    })
    const dialog = await screen.findByRole("dialog", { name: "Py Helper" })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)

    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" })
    })
    // The close animation ends before the dialog unmounts and the trigger is shown again.
    act(() => {
      fireEvent.animationEnd(dialog.parentElement as HTMLElement)
    })
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "open-chatbot" }))
  })
})

describe("chatbot disclaimer (B-014)", () => {
  it("uses a heading level below the dialog title", () => {
    render(<ChatbotDisclaimer />)
    expect(screen.getByRole("heading", { level: 4, name: "about-the-chatbot" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull()
  })
})
