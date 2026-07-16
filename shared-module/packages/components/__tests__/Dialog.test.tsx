"use client"

/* oxlint-disable i18next/no-literal-string */

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"

import { Dialog } from "../src/components/Dialog"
import { testI18n } from "../tests/test-i18n"
import { domClick, renderUi } from "./testUtils"

// The real key lives in the canonical shared-module locale files.
testI18n.addResource("en", "shared-module", "close", "Close")

/** Trigger button that opens a Dialog, for focus management tests. */
function DialogHarness(props: { isDismissable?: boolean; onClose?: () => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          props.onClose?.()
        }}
        title="Harness dialog"
        isDismissable={props.isDismissable ?? false}
      >
        <p>Dialog body</p>
      </Dialog>
    </>
  )
}

function clickUnderlay() {
  const underlay = screen.getByRole("dialog").parentElement!
  fireEvent.pointerDown(underlay)
  fireEvent.click(underlay)
}

describe("Dialog", () => {
  test("renders nothing when closed", () => {
    renderUi(
      <Dialog open={false} onClose={jest.fn()} title="Hidden dialog">
        <p>Hidden content</p>
      </Dialog>,
    )
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument()
  })

  test("renders with role dialog and accessible name from title", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Settings">
        <p>Content</p>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Settings" })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByText("Content")).toBeInTheDocument()
  })

  test("supports aria-label instead of a visible title", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} aria-label="Unlabeled dialog">
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.getByRole("dialog", { name: "Unlabeled dialog" })).toBeInTheDocument()
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  test("sets aria-modal", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Modal dialog">
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true")
  })

  test("moves focus into the dialog on open and restores it to the trigger on close", async () => {
    render(<DialogHarness />)
    const trigger = screen.getByRole("button", { name: "Open dialog" })
    trigger.focus()

    domClick(trigger)
    const dialog = screen.getByRole("dialog", { name: "Harness dialog" })
    // Focus moves after a frame when the interaction modality is virtual
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    domClick(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    // Focus restore also runs a frame after unmount
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  test("calls onClose on Escape", () => {
    const onClose = jest.fn()
    renderUi(
      <Dialog open onClose={onClose} title="Escapable dialog">
        <p>Content</p>
      </Dialog>,
    )
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("calls onClose on underlay click when isDismissable", () => {
    const onClose = jest.fn()
    renderUi(
      <Dialog open onClose={onClose} title="Dismissable dialog" isDismissable>
        <p>Content</p>
      </Dialog>,
    )
    clickUnderlay()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("does not call onClose on underlay click when not dismissable", () => {
    const onClose = jest.fn()
    renderUi(
      <Dialog open onClose={onClose} title="Sticky dialog">
        <p>Content</p>
      </Dialog>,
    )
    clickUnderlay()
    expect(onClose).not.toHaveBeenCalled()
  })

  test("close button calls onClose and can be hidden", () => {
    const onClose = jest.fn()
    const { rerender } = renderUi(
      <Dialog open onClose={onClose} title="Closeable dialog">
        <p>Content</p>
      </Dialog>,
    )
    domClick(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledTimes(1)

    rerender(
      <Dialog open onClose={onClose} title="Closeable dialog" showCloseButton={false}>
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
  })

  test("renders footer content and passes through lang and data-testid", () => {
    renderUi(
      <Dialog
        open
        onClose={jest.fn()}
        title="Vahvista"
        lang="fi"
        data-testid="confirm-dialog"
        footer={<button type="button">Tallenna</button>}
      >
        <p>Sisältö</p>
      </Dialog>,
    )
    const dialog = screen.getByTestId("confirm-dialog")
    expect(dialog).toHaveAttribute("lang", "fi")
    expect(dialog).toHaveAttribute("role", "dialog")
    expect(screen.getByRole("button", { name: "Tallenna" })).toBeInTheDocument()
  })
})
