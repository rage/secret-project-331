"use client"

import "../tests/inert-focus"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"

import { Dialog } from "../src/components/Dialog"
import { DialogProvider, useDialog } from "../src/components/dialogProvider/DialogProvider"
import { CONFIRM_DIALOG_YES_BUTTON_TEST_ID } from "../src/components/dialogProvider/testIds"
import { focusProgrammatically } from "../src/components/RouteFocusManager"
import { testI18n } from "../tests/test-i18n"

testI18n.addResource("en", "shared-module", "close", "Close")

const settleFrames = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 100)
      }),
  )

function TwoButtonDialog() {
  return (
    <Dialog open onClose={jest.fn()} title="Contained">
      <button type="button">First</button>
      <button type="button">Last</button>
    </Dialog>
  )
}

/** The trigger unmounts on confirm, like exam Start; the heading takes focus right after. */
function ConfirmThenFocus() {
  const { confirm } = useDialog()
  const [started, setStarted] = React.useState(false)
  React.useEffect(() => {
    const heading = started && document.querySelector<HTMLElement>("h1")
    if (heading) {
      focusProgrammatically(heading)
    }
  }, [started])
  return started ? (
    <h1 data-testid="heading">Started</h1>
  ) : (
    <button
      type="button"
      onClick={async () => {
        if (await confirm("Sure?")) {
          setStarted(true)
        }
      }}
    >
      Start
    </button>
  )
}

/** Like signup: the page asks for focus on its heading while a consent dialog is still open. */
function HeadingBehindDialog() {
  const [open, setOpen] = React.useState(true)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  React.useEffect(() => {
    if (headingRef.current) {
      focusProgrammatically(headingRef.current)
    }
  }, [])
  return (
    <>
      <h1 ref={headingRef}>Confirm your email</h1>
      <Dialog open={open} onClose={() => setOpen(false)} title="Consent">
        <button type="button">Save</button>
      </Dialog>
    </>
  )
}

function ConfirmTrigger() {
  const { confirm } = useDialog()
  return (
    <button type="button" onClick={() => void confirm("Sure?")}>
      Ask
    </button>
  )
}

describe("Dialog focus", () => {
  test("Tab from the last element stays inside a modal dialog", async () => {
    const user = userEvent.setup()
    render(<TwoButtonDialog />)
    const dialog = screen.getByRole("dialog")
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    screen.getByRole("button", { name: "Last" }).focus()
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  test("focus set programmatically when a confirm closes survives the close", async () => {
    const user = userEvent.setup()
    render(
      <DialogProvider>
        <ConfirmThenFocus />
      </DialogProvider>,
    )
    await user.click(screen.getByRole("button", { name: "Start" }))
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument())
    await user.click(screen.getByTestId(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await settleFrames()
    expect(screen.getByTestId("heading")).toHaveFocus()
  })

  test("focus asked for behind an open dialog lands on it once the dialog closes", async () => {
    const user = userEvent.setup()
    render(<HeadingBehindDialog />)
    const dialog = screen.getByRole("dialog")
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await settleFrames()
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus()
  })

  test("Escape with focus on the confirm container returns focus to the trigger", async () => {
    const user = userEvent.setup()
    render(
      <DialogProvider>
        <ConfirmTrigger />
      </DialogProvider>,
    )
    const trigger = screen.getByRole("button", { name: "Ask" })
    await user.click(trigger)
    const dialog = await screen.findByRole("alertdialog")
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    // Tab, Tab: No, Yes, then the dialog container itself.
    await user.tab()
    await user.tab()
    await user.tab()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await settleFrames()
    expect(trigger).toHaveFocus()
  })
})
