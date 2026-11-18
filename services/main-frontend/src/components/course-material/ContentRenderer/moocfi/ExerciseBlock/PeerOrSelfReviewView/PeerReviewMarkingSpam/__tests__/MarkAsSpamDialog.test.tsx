"use client"

import "@testing-library/jest-dom"
import { OverlayProvider } from "@react-aria/overlays"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import MarkAsSpamDialog from "../MarkAsSpamDialog"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("MarkAsSpamDialog (report dialog, issue #64)", () => {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- colocated with its describe block for readability
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

  it("keeps the unselected radio group reachable with Tab (no radio is taken out of the tab order)", () => {
    renderDialog()
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("tabindex", "-1")
    }
  })

  it("calls onExitComplete once the closed dialog has left", async () => {
    const onExitComplete = jest.fn()
    const { rerender } = render(
      <OverlayProvider>
        <MarkAsSpamDialog
          isOpen
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          onExitComplete={onExitComplete}
        />
      </OverlayProvider>,
    )
    rerender(
      <OverlayProvider>
        <MarkAsSpamDialog
          isOpen={false}
          onClose={jest.fn()}
          onSubmit={jest.fn()}
          onExitComplete={onExitComplete}
        />
      </OverlayProvider>,
    )
    await waitFor(() => expect(onExitComplete).toHaveBeenCalled())
  })
})
