"use client"

import { OverlayProvider } from "@react-aria/overlays"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React, { useState } from "react"
import { I18nextProvider } from "react-i18next"

import i18nTest from "../../../utils/testing/i18nTest"
import StandardDialog from "../StandardDialog"

const Wrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
  <I18nextProvider i18n={i18nTest}>
    <OverlayProvider>{children}</OverlayProvider>
  </I18nextProvider>
)

const Harness: React.FC<{ lang?: string }> = ({ lang }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <StandardDialog open={open} onClose={() => setOpen(false)} title="Dialog title" lang={lang}>
          <button>Inside button</button>
        </StandardDialog>
      )}
    </>
  )
}

describe("StandardDialog", () => {
  it("sets the lang attribute on the dialog root when given", () => {
    render(<Harness lang="fi-FI" />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText("Open dialog"))
    const dialog = screen.getByTestId("dialog")
    expect(dialog).toHaveAttribute("lang", "fi-FI")
  })

  it("does not set a lang attribute when not given", () => {
    render(<Harness />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText("Open dialog"))
    expect(screen.getByTestId("dialog")).not.toHaveAttribute("lang")
  })

  it("moves focus into the dialog on open and restores it to the trigger on close", async () => {
    render(<Harness />, { wrapper: Wrapper })
    const trigger = screen.getByText("Open dialog")
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByTestId("dialog")
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    fireEvent.click(screen.getByRole("button", { name: /close/i }))
    await waitFor(() => {
      expect(screen.queryByTestId("dialog")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
  })

  it("labels the dialog with its title", () => {
    render(<Harness />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText("Open dialog"))
    expect(screen.getByRole("dialog", { name: "Dialog title" })).toBeInTheDocument()
  })
})
