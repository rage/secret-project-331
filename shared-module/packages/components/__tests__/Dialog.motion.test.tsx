"use client"

import { screen, waitFor } from "@testing-library/react"
import React from "react"

import { Dialog, type DialogExit } from "../src/components/Dialog"
import { omitUndefined } from "../src/lib/utils/nullability"
import { testI18n } from "../tests/test-i18n"
import { domClick, renderUi } from "./testUtils"

testI18n.addResource("en", "shared-module", "close", "Close")

function ExitHarness({ exit }: { exit?: DialogExit }) {
  const [open, setOpen] = React.useState(true)
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Harness" {...omitUndefined({ exit })}>
      <p>Body</p>
    </Dialog>
  )
}

function getUnderlay() {
  return screen.getByRole("dialog").parentElement as HTMLElement
}

/** The exit animation only plays from a fully-entered state; closing mid-entrance has nothing to animate. */
async function waitForFullyOpen(underlay: HTMLElement) {
  await waitFor(() => expect(underlay.style.opacity).toBe("1"))
}

describe("Dialog exit animation", () => {
  test("fade (the default) keeps the scrim visible for a moment after close", async () => {
    renderUi(<ExitHarness />)
    const underlay = getUnderlay()
    await waitForFullyOpen(underlay)

    domClick(screen.getByRole("button", { name: "Close" }))
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 60)
    })
    expect(underlay.style.opacity).not.toBe("0")

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })

  test("handoff drops the scrim immediately, while the surface is still exiting", async () => {
    renderUi(<ExitHarness exit="handoff" />)
    const underlay = getUnderlay()
    await waitForFullyOpen(underlay)

    domClick(screen.getByRole("button", { name: "Close" }))
    await waitFor(() => expect(underlay.style.opacity).toBe("0"), { timeout: 100 })
    // Proves the scrim's drop is not just the whole dialog unmounting early: the surface (and its
    // own, unshortened exit) is still present at the instant the scrim already reads zero.
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  })
})
