"use client"

import { render, screen, waitFor, within } from "@testing-library/react"

import { DialogProvider, useDialog } from "../src/components/dialogProvider/DialogProvider"
import {
  CONFIRM_DIALOG_YES_BUTTON_TEST_ID,
  DIALOG_PROVIDER_DIALOG_TEST_ID,
} from "../src/components/dialogProvider/testIds"
import "../tests/test-i18n"
import { domClick } from "./testUtils"

/**
 * motion/react reads `prefers-reduced-motion` once and caches it for the life of the module, so the
 * mock has to be in place before any `useReducedMotion()` call in this file. Hence a file of its own.
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

function TwoConfirms({ onAnswers }: { onAnswers: (answers: boolean[]) => void }) {
  const { confirm } = useDialog()
  const run = async () => {
    onAnswers(await Promise.all([confirm("First?"), confirm("Second?")]))
  }
  return (
    <button
      type="button"
      onClick={() => {
        void run()
      }}
    >
      Ask twice
    </button>
  )
}

function getDialogs() {
  return screen.queryAllByTestId(DIALOG_PROVIDER_DIALOG_TEST_ID)
}

describe("the dialog queue under prefers-reduced-motion", () => {
  test("still overlaps the outgoing and incoming dialogs, and still restores focus", async () => {
    const answers: boolean[][] = []
    render(
      <DialogProvider>
        <TwoConfirms
          onAnswers={(value) => {
            answers.push(value)
          }}
        />
      </DialogProvider>,
    )

    const trigger = screen.getByRole("button", { name: "Ask twice" })
    trigger.focus()
    domClick(trigger)

    const first = screen.getByRole("alertdialog", { name: "First?" })
    await waitFor(() => expect(first).toHaveFocus())
    domClick(within(first).getByTestId(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))

    // The overlap exists for focus continuity, not for looks, so reduced motion shortens the
    // animation without letting focus fall back to the page in between.
    expect(getDialogs()).toHaveLength(2)
    const second = screen.getByRole("alertdialog", { name: "Second?" })
    await waitFor(() => expect(second).toHaveFocus())
    expect(trigger).not.toHaveFocus()

    domClick(within(second).getByTestId(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))
    await waitFor(() => expect(getDialogs()).toHaveLength(0))
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(answers).toEqual([[true, true]])
  })
})
