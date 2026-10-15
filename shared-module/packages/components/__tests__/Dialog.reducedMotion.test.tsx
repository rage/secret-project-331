"use client"

import { screen, waitFor } from "@testing-library/react"
import React from "react"

import { Dialog } from "../src/components/Dialog"
import { testI18n } from "../tests/test-i18n"
import { domClick, renderUi } from "./testUtils"

testI18n.addResource("en", "shared-module", "close", "Close")

/**
 * motion/react reads `prefers-reduced-motion` lazily and caches the result for the life of the
 * module, so the mock must be in place before the first `useReducedMotion()` call anywhere in
 * this file. That is why this lives in its own file, separate from Dialog.motion.test.tsx.
 */
beforeAll(() => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })) as unknown as typeof window.matchMedia
})

function Harness() {
  const [open, setOpen] = React.useState(true)
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Harness">
      <p>Body</p>
    </Dialog>
  )
}

describe("Dialog under prefers-reduced-motion", () => {
  test("opens with no translate/scale entrance", () => {
    renderUi(<Harness />)
    const surface = screen.getByRole("dialog")
    expect(surface.style.opacity).toBe("1")
    expect(surface.style.transform).toBe("")
  })

  test("closes by cross-fading rather than translating", async () => {
    renderUi(<Harness />)
    const surface = screen.getByRole("dialog")
    const underlay = surface.parentElement as HTMLElement

    domClick(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(underlay.style.opacity).toBe("0"))
    expect(surface.style.transform).toBe("")
  })
})
