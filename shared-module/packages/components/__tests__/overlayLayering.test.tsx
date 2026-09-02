"use client"

import { fireEvent, screen } from "@testing-library/react"

import { Dialog } from "../src/components/Dialog"
import { popoverCss } from "../src/components/primitives/selectStyles"
import { Select } from "../src/components/Select"
import { renderWithForm } from "./testUtils"

const countryOptions = [
  { value: "fi", label: "Finland" },
  { value: "se", label: "Sweden" },
] as const

/**
 * react-aria portals every overlay (`Overlay` -> `createPortal(..., document.body)`) as a direct
 * child of `document.body`, so a dialog underlay and a popover underlay are siblings there, never
 * nested. Walks up from `el` to the ancestor that is itself a direct child of `document.body`.
 */
function portalRootOf(el: Element): Element {
  let node = el
  while (node.parentElement && node.parentElement !== document.body) {
    node = node.parentElement
  }
  return node
}

describe("overlay layering", () => {
  test("a popover opened inside a dialog shares the dialog's layer and mounts after it", () => {
    renderWithForm<{ country: string }>((control) => (
      <Dialog open onClose={jest.fn()} title="Pick a plan">
        <Select name="country" control={control} label="Country" options={countryOptions} />
      </Dialog>
    ))

    const dialogRoot = portalRootOf(screen.getByRole("dialog"))

    fireEvent.click(screen.getByRole("button", { name: /Country/ }))
    const popoverRoot = portalRootOf(screen.getByRole("listbox"))

    expect(dialogRoot).not.toBe(popoverRoot)
    expect(dialogRoot.parentElement).toBe(document.body)
    expect(popoverRoot.parentElement).toBe(document.body)

    const dialogZIndex = getComputedStyle(dialogRoot).zIndex
    const popoverZIndex = getComputedStyle(popoverRoot).zIndex
    expect(dialogZIndex).toBe("var(--layer-overlay)")
    expect(popoverZIndex).toBe(dialogZIndex)

    // Equal z-index means the browser falls back to paint order: whichever overlay is the
    // later sibling under <body> renders on top. The popover opened after the dialog, so it
    // must be the later sibling for it to appear above the dialog's scrim.
    const bodyChildren = Array.from(document.body.children)
    expect(bodyChildren.indexOf(popoverRoot)).toBeGreaterThan(bodyChildren.indexOf(dialogRoot))
  })

  test("the popover surface no longer declares its own stacking z-index", () => {
    const probe = document.createElement("div")
    probe.className = popoverCss
    document.body.append(probe)

    // react-aria sets an inline `zIndex: 100000` on the real popover surface, which always wins
    // over a class rule regardless of what popoverCss declares. Checking a bare probe node
    // (no inline style) is the only way to see whether popoverCss itself still sets one.
    expect(getComputedStyle(probe).zIndex).toBe("")
  })
})
