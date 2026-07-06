"use client"

import "@testing-library/jest-dom"

import { OverlayProvider } from "@react-aria/overlays"
import { fireEvent, render, screen } from "@testing-library/react"

import MarkAsSpamDialog from "../MarkAsSpamDialog"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("MarkAsSpamDialog (report dialog, issue #64)", () => {
  const renderDialog = (onSubmit = jest.fn(), onClose = jest.fn()) => {
    render(
      <OverlayProvider>
        <MarkAsSpamDialog isOpen onClose={onClose} onSubmit={onSubmit} />
      </OverlayProvider>,
    )
    return { onSubmit, onClose }
  }

  it("associates the dialog with its title", () => {
    renderDialog()
    expect(screen.getByRole("dialog", { name: "title-report-dialog" })).toBeInTheDocument()
  })

  it("renders the reasons as a radiogroup with an accessible group label", () => {
    renderDialog()
    const group = screen.getByRole("radiogroup", { name: "select-reason" })
    expect(group).toBeInTheDocument()

    expect(screen.getByRole("radio", { name: "flagging-reason-spam" })).toBeInTheDocument()
    expect(
      screen.getByRole("radio", { name: "flagging-reason-harmful-content" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "flagging-reason-ai-generated" })).toBeInTheDocument()
  })

  it("labels the description textarea with a real label instead of only a placeholder", () => {
    renderDialog()
    const textarea = screen.getByLabelText("optional-description")
    expect(textarea.tagName).toBe("TEXTAREA")
  })

  it("submits the selected reason and description", () => {
    const { onSubmit, onClose } = renderDialog()

    const submitButton = screen.getByRole("button", { name: "submit-button" })
    expect(submitButton).toBeDisabled()

    fireEvent.click(screen.getByRole("radio", { name: "flagging-reason-spam" }))
    fireEvent.change(screen.getByLabelText("optional-description"), {
      target: { value: "details" },
    })

    expect(submitButton).toBeEnabled()
    fireEvent.click(submitButton)

    expect(onSubmit).toHaveBeenCalledWith("Spam", "details")
    expect(onClose).toHaveBeenCalled()
  })
})
