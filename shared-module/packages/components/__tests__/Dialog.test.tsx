"use client"

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

/**
 * react-aria dismisses via document-level listeners on the modal ref, not handlers on the underlay
 * element, and binds either pointerdown+click or mousedown+mouseup depending on whether the
 * environment has `PointerEvent` (jsdom does not). Only one pair is ever bound, so firing both
 * still dismisses exactly once, and the test does not depend on which branch jsdom takes.
 */
function clickUnderlay() {
  const underlay = screen.getByRole("dialog").parentElement!
  fireEvent.pointerDown(underlay)
  fireEvent.mouseDown(underlay)
  fireEvent.mouseUp(underlay)
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
    // The dialog stays mounted through its exit animation before actually unmounting.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
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

  test("renders every action", () => {
    renderUi(
      <Dialog
        open
        onClose={jest.fn()}
        title="Confirm deletion"
        actions={[{ label: "Cancel", variant: "secondary" }, { label: "Delete" }]}
      >
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
  })

  test("calls the handler of the pressed action only", () => {
    const onCancel = jest.fn()
    const onDelete = jest.fn()
    renderUi(
      <Dialog
        open
        onClose={jest.fn()}
        title="Confirm deletion"
        actions={[
          { label: "Cancel", onPress: onCancel },
          { label: "Delete", onPress: onDelete },
        ]}
      >
        <p>Content</p>
      </Dialog>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  test("disables an action", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Save" actions={[{ label: "Save", disabled: true }]}>
        <p>Content</p>
      </Dialog>,
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  test("padding defaults to normal", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Padded">
        <p>Content</p>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog")
    expect(getComputedStyle(dialog).getPropertyValue("--dialog-padding")).toBe("var(--space-5)")
  })

  test("padding none collapses --dialog-padding to zero", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Flush" padding="none">
        <p>Content</p>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog")
    expect(getComputedStyle(dialog).getPropertyValue("--dialog-padding")).toBe("0")
  })

  test("role defaults to dialog with no aria-describedby", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Settings">
        <p>Content</p>
      </Dialog>,
    )
    const dialog = screen.getByRole("dialog", { name: "Settings" })
    expect(dialog).not.toHaveAttribute("aria-describedby")
  })

  test("alertdialog role wires aria-describedby to a description that actually resolves", () => {
    renderUi(
      <Dialog open onClose={jest.fn()} title="Delete course" role="alertdialog">
        <p>This cannot be undone.</p>
      </Dialog>,
    )
    const dialog = screen.getByRole("alertdialog", { name: "Delete course" })
    const describedBy = dialog.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const description = describedBy ? document.querySelector(`[id="${describedBy}"]`) : null
    expect(description).not.toBeNull()
    expect(description).toHaveTextContent("This cannot be undone.")
  })
})
