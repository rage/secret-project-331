"use client"

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import React from "react"

import { DialogProvider, useDialog } from "../src/components/dialogProvider/DialogProvider"
import type {
  AlertRequest,
  ConfirmRequest,
  CustomPromptRequest,
  DialogApi,
  PromptResult,
  TextPromptRequest,
} from "../src/components/dialogProvider/dialogRequests"
import {
  ALERT_DIALOG_OK_BUTTON_TEST_ID,
  CONFIRM_DIALOG_NO_BUTTON_TEST_ID,
  CONFIRM_DIALOG_YES_BUTTON_TEST_ID,
  DIALOG_PROVIDER_DIALOG_TEST_ID,
  PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID,
  PROMPT_DIALOG_INPUT_TEST_ID,
  PROMPT_DIALOG_OK_BUTTON_TEST_ID,
} from "../src/components/dialogProvider/testIds"
import "../tests/test-i18n"
import { domClick } from "./testUtils"

let results: unknown[] = []

beforeEach(() => {
  results = []
})

function record(result: unknown) {
  results.push(result)
}

function AlertButton({ request, label }: { request: AlertRequest | string; label: string }) {
  const { alert } = useDialog()
  const run = async () => {
    record(await alert(request))
  }
  return (
    <button
      type="button"
      onClick={() => {
        void run()
      }}
    >
      {label}
    </button>
  )
}

function ConfirmButton({
  request,
  label,
  tag,
}: {
  request: ConfirmRequest | string
  label: string
  tag?: string
}) {
  const { confirm } = useDialog()
  const run = async () => {
    const answer = await confirm(request)
    record(tag === undefined ? answer : `${tag}:${String(answer)}`)
  }
  return (
    <button
      type="button"
      onClick={() => {
        void run()
      }}
    >
      {label}
    </button>
  )
}

function TextPromptButton({ request, label }: { request: TextPromptRequest; label: string }) {
  const { prompt } = useDialog()
  const run = async () => {
    record(await prompt(request))
  }
  return (
    <button
      type="button"
      onClick={() => {
        void run()
      }}
    >
      {label}
    </button>
  )
}

function CustomPromptButton<T>({
  request,
  label,
}: {
  request: CustomPromptRequest<T>
  label: string
}) {
  const { prompt } = useDialog()
  const run = async () => {
    record(await prompt(request))
  }
  return (
    <button
      type="button"
      onClick={() => {
        void run()
      }}
    >
      {label}
    </button>
  )
}

function OrphanCaller() {
  useDialog()
  return null
}

function ExplodingBody(): React.ReactNode {
  throw new Error("body exploded")
}

/** Stands in for the app-level boundary that a dialog body's crash unwinds to. */
class TestBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  public constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  public static getDerivedStateFromError() {
    return { hasError: true }
  }

  public override render() {
    return this.state.hasError ? <p>Something broke</p> : this.props.children
  }
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<DialogProvider>{ui}</DialogProvider>)
}

function getDialogs() {
  return screen.queryAllByTestId(DIALOG_PROVIDER_DIALOG_TEST_ID)
}

async function waitForNoDialogs() {
  await waitFor(() => expect(getDialogs()).toHaveLength(0))
}

/** The topmost dialog. During a handoff the one being replaced is still mounted behind it. */
function currentDialog(): HTMLElement {
  const dialogs = getDialogs()
  const top = dialogs[dialogs.length - 1]
  if (top === undefined) {
    throw new Error("No dialog is open")
  }
  return top
}

function partOfCurrentDialog(testId: string) {
  return within(currentDialog()).getByTestId(testId)
}

function pressEscape() {
  fireEvent.keyDown(currentDialog(), { key: "Escape" })
}

describe("alert", () => {
  test("resolves when the acknowledge action is pressed", async () => {
    renderWithProvider(<AlertButton request="Saving failed" label="Warn" />)

    domClick(screen.getByRole("button", { name: "Warn" }))
    expect(screen.getByRole("alertdialog", { name: "Saving failed" })).toBeInTheDocument()

    domClick(partOfCurrentDialog(ALERT_DIALOG_OK_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual([undefined]))
    await waitForNoDialogs()
  })

  test("resolves on Escape", async () => {
    renderWithProvider(<AlertButton request="Saving failed" label="Warn" />)

    domClick(screen.getByRole("button", { name: "Warn" }))
    pressEscape()

    await waitFor(() => expect(results).toEqual([undefined]))
  })

  test("defaults its action to dialog.ok and takes an override", async () => {
    renderWithProvider(
      <>
        <AlertButton request="Plain" label="Plain" />
        <AlertButton
          request={{ message: "Labelled", acknowledgeLabel: "Got it" }}
          label="Labelled"
        />
      </>,
    )

    domClick(screen.getByRole("button", { name: "Plain" }))
    expect(partOfCurrentDialog(ALERT_DIALOG_OK_BUTTON_TEST_ID)).toHaveAccessibleName("OK")
    domClick(partOfCurrentDialog(ALERT_DIALOG_OK_BUTTON_TEST_ID))
    await waitForNoDialogs()

    domClick(screen.getByRole("button", { name: "Labelled" }))
    expect(partOfCurrentDialog(ALERT_DIALOG_OK_BUTTON_TEST_ID)).toHaveAccessibleName("Got it")
  })
})

describe("confirm", () => {
  test("resolves true from the affirmative action and false from the negative one", async () => {
    renderWithProvider(<ConfirmButton request="Delete the page?" label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    domClick(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual([true]))
    await waitForNoDialogs()

    domClick(screen.getByRole("button", { name: "Ask" }))
    domClick(partOfCurrentDialog(CONFIRM_DIALOG_NO_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual([true, false]))
  })

  test("resolves false on Escape", async () => {
    renderWithProvider(<ConfirmButton request="Delete the page?" label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    pressEscape()

    await waitFor(() => expect(results).toEqual([false]))
  })

  test("labels default to Yes and No and are overridable per call", async () => {
    renderWithProvider(
      <>
        <ConfirmButton request="Plain" label="Plain" />
        <ConfirmButton
          request={{ message: "Labelled", confirmLabel: "Delete course", cancelLabel: "Keep it" }}
          label="Labelled"
        />
      </>,
    )

    domClick(screen.getByRole("button", { name: "Plain" }))
    expect(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID)).toHaveAccessibleName("Yes")
    expect(partOfCurrentDialog(CONFIRM_DIALOG_NO_BUTTON_TEST_ID)).toHaveAccessibleName("No")
    domClick(partOfCurrentDialog(CONFIRM_DIALOG_NO_BUTTON_TEST_ID))
    await waitForNoDialogs()

    domClick(screen.getByRole("button", { name: "Labelled" }))
    expect(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID)).toHaveAccessibleName(
      "Delete course",
    )
    expect(partOfCurrentDialog(CONFIRM_DIALOG_NO_BUTTON_TEST_ID)).toHaveAccessibleName("Keep it")
  })

  test("isDestructive renders the danger fill without arming it with focus", async () => {
    renderWithProvider(
      <ConfirmButton
        request={{
          title: "Delete course",
          message: "This cannot be undone.",
          confirmLabel: "Delete course",
          isDestructive: true,
        }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    const dialog = screen.getByRole("alertdialog", { name: "Delete course" })
    const destructiveAction = partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID)
    expect(getComputedStyle(destructiveAction).background).toContain("var(--btn-danger-bg)")

    await waitFor(() => expect(dialog).toHaveFocus())
    expect(destructiveAction).not.toHaveFocus()
    expect(partOfCurrentDialog(CONFIRM_DIALOG_NO_BUTTON_TEST_ID)).not.toHaveFocus()
  })

  test("renders the title as the name, the message, and the description", () => {
    renderWithProvider(
      <ConfirmButton
        request={{
          title: "Delete course",
          message: "Delete Intro to Programming?",
          description: "All of its pages are deleted permanently.",
        }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(screen.getByRole("alertdialog", { name: "Delete course" })).toBeInTheDocument()
    expect(screen.getByText("Delete Intro to Programming?")).toBeInTheDocument()
    expect(screen.getByText("All of its pages are deleted permanently.")).toBeInTheDocument()
  })
})

describe("role selection", () => {
  test("a string message announces itself as an alertdialog", () => {
    renderWithProvider(<ConfirmButton request="End the exam?" label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    const dialog = screen.getByRole("alertdialog", { name: "End the exam?" })
    const describedBy = dialog.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    expect(document.querySelector(`[id="${describedBy}"]`)).toHaveTextContent("End the exam?")
  })

  test("a node message is a plain dialog, named by the kind when there is no title", () => {
    renderWithProvider(<ConfirmButton request={{ message: <p>A whole report</p> }} label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    const dialog = screen.getByRole("dialog", { name: "Confirmation required" })
    expect(dialog).not.toHaveAttribute("aria-describedby")
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  test("a prompt is a plain dialog even with a string message", () => {
    renderWithProvider(<TextPromptButton request={{ message: "New chapter name" }} label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(screen.getByRole("dialog", { name: "New chapter name" })).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })
})

describe("prompt", () => {
  test("resolves the typed value and focuses the field on open", async () => {
    renderWithProvider(<TextPromptButton request={{ message: "New name" }} label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    const input = partOfCurrentDialog(PROMPT_DIALOG_INPUT_TEST_ID)
    await waitFor(() => expect(input).toHaveFocus())
    expect(input).toHaveAccessibleName("New name")

    fireEvent.change(input, { target: { value: "Chapter 2" } })
    domClick(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID))

    await waitFor(() =>
      expect(results).toEqual([
        { isSubmitted: true, value: "Chapter 2" },
      ] satisfies PromptResult<string>[]),
    )
  })

  test("resolves as not submitted when cancelled or escaped", async () => {
    renderWithProvider(<TextPromptButton request={{ message: "New name" }} label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    domClick(partOfCurrentDialog(PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual([{ isSubmitted: false }]))
    await waitForNoDialogs()

    domClick(screen.getByRole("button", { name: "Ask" }))
    pressEscape()
    await waitFor(() => expect(results).toEqual([{ isSubmitted: false }, { isSubmitted: false }]))
  })

  test("an empty submission stays distinguishable from a cancellation", async () => {
    renderWithProvider(<TextPromptButton request={{ message: "New name" }} label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    const input = partOfCurrentDialog(PROMPT_DIALOG_INPUT_TEST_ID)
    fireEvent.change(input, { target: { value: "a" } })
    fireEvent.change(input, { target: { value: "" } })
    domClick(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID))

    await waitFor(() => expect(results).toEqual([{ isSubmitted: true, value: "" }]))
  })

  test("submit is disabled until the body sets a value", async () => {
    renderWithProvider(
      <CustomPromptButton<string>
        request={{
          message: "Pick a suggestion",
          body: ({ setValue }) => (
            <button
              type="button"
              onClick={() => {
                setValue("chosen")
              }}
            >
              Choose
            </button>
          ),
        }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID)).toBeDisabled()

    domClick(screen.getByRole("button", { name: "Choose" }))
    expect(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID)).toBeEnabled()

    domClick(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual([{ isSubmitted: true, value: "chosen" }]))
  })

  test("defaultValue arms submit without any interaction", () => {
    renderWithProvider(
      <TextPromptButton request={{ message: "New name", defaultValue: "Chapter 1" }} label="Ask" />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(partOfCurrentDialog(PROMPT_DIALOG_INPUT_TEST_ID)).toHaveValue("Chapter 1")
    expect(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID)).toBeEnabled()
  })

  test("validate blocks submission and shows its message on the field", async () => {
    renderWithProvider(
      <TextPromptButton
        request={{
          message: "New name",
          validate: (value) => (value.length < 3 ? "Too short" : undefined),
        }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    const input = partOfCurrentDialog(PROMPT_DIALOG_INPUT_TEST_ID)
    fireEvent.change(input, { target: { value: "ab" } })
    domClick(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID))

    expect(screen.getByRole("alert")).toHaveTextContent("Too short")
    expect(input).toBeInvalid()
    expect(results).toEqual([])

    fireEvent.change(input, { target: { value: "abc" } })
    domClick(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual([{ isSubmitted: true, value: "abc" }]))
  })

  test("a body can submit and dismiss on its own", async () => {
    renderWithProvider(
      <CustomPromptButton<number>
        request={{
          message: "Pick a number",
          body: ({ submit, dismiss }) => (
            <>
              <button
                type="button"
                onClick={() => {
                  submit(7)
                }}
              >
                Seven
              </button>
              <button type="button" onClick={dismiss}>
                Never mind
              </button>
            </>
          ),
        }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    domClick(screen.getByRole("button", { name: "Seven" }))
    await waitFor(() => expect(results).toEqual([{ isSubmitted: true, value: 7 }]))
    await waitForNoDialogs()

    domClick(screen.getByRole("button", { name: "Ask" }))
    domClick(screen.getByRole("button", { name: "Never mind" }))
    await waitFor(() =>
      expect(results).toEqual([{ isSubmitted: true, value: 7 }, { isSubmitted: false }]),
    )
  })

  test("labels default to OK and Cancel and are overridable", () => {
    renderWithProvider(
      <TextPromptButton
        request={{ message: "New name", submitLabel: "Rename", cancelLabel: "Leave it" }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID)).toHaveAccessibleName("Rename")
    expect(partOfCurrentDialog(PROMPT_DIALOG_CANCEL_BUTTON_TEST_ID)).toHaveAccessibleName(
      "Leave it",
    )
  })
})

describe("the queue", () => {
  function TwoConfirms() {
    const { confirm } = useDialog()
    const run = async () => {
      const [first, second] = await Promise.all([confirm("First?"), confirm("Second?")])
      record(`first:${String(first)}`)
      record(`second:${String(second)}`)
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

  test("shows depth-0 requests one at a time, in call order", async () => {
    renderWithProvider(<TwoConfirms />)

    domClick(screen.getByRole("button", { name: "Ask twice" }))
    expect(getDialogs()).toHaveLength(1)
    expect(screen.getByRole("alertdialog", { name: "First?" })).toBeInTheDocument()
    expect(screen.queryByRole("alertdialog", { name: "Second?" })).not.toBeInTheDocument()

    domClick(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))
    await waitFor(() =>
      expect(screen.getByRole("alertdialog", { name: "Second?" })).toBeInTheDocument(),
    )

    domClick(partOfCurrentDialog(CONFIRM_DIALOG_NO_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual(["first:true", "second:false"]))
  })

  test("keeps the outgoing dialog mounted while its successor opens", async () => {
    renderWithProvider(<TwoConfirms />)

    domClick(screen.getByRole("button", { name: "Ask twice" }))
    domClick(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))

    // Both are mounted in the same commit, so focus moves straight from one to the other rather
    // than bouncing back to the trigger in between.
    expect(getDialogs()).toHaveLength(2)
    expect(screen.getByRole("alertdialog", { name: "Second?" })).toBeInTheDocument()

    await waitFor(() => expect(getDialogs()).toHaveLength(1))
  })

  test("restores focus to the trigger only after the whole sequence is answered", async () => {
    renderWithProvider(<TwoConfirms />)

    const trigger = screen.getByRole("button", { name: "Ask twice" })
    trigger.focus()
    domClick(trigger)

    await waitFor(() => expect(screen.getByRole("alertdialog", { name: "First?" })).toHaveFocus())
    domClick(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))

    await waitFor(() => expect(getDialogs()).toHaveLength(1))
    expect(trigger).not.toHaveFocus()
    await waitFor(() => expect(screen.getByRole("alertdialog", { name: "Second?" })).toHaveFocus())

    domClick(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))
    await waitForNoDialogs()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  test("a request made from inside an open dialog stacks instead of queueing behind it", async () => {
    function NestedConfirm() {
      const { confirm } = useDialog()
      const run = async () => {
        record(`nested:${String(await confirm("Discard the draft?"))}`)
      }
      return (
        <button
          type="button"
          onClick={() => {
            void run()
          }}
        >
          Ask from inside
        </button>
      )
    }

    renderWithProvider(
      <CustomPromptButton<string>
        request={{
          title: "Outer",
          message: "Outer body",
          body: ({ setValue }) => (
            <>
              <NestedConfirm />
              <button
                type="button"
                onClick={() => {
                  setValue("done")
                }}
              >
                Choose
              </button>
            </>
          ),
        }}
        label="Ask"
      />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    domClick(screen.getByRole("button", { name: "Ask from inside" }))

    // Pure FIFO would deadlock here: the nested request would wait for a dialog that is itself
    // waiting on the answer to the nested request.
    expect(getDialogs()).toHaveLength(2)
    expect(screen.getByRole("alertdialog", { name: "Discard the draft?" })).toBeInTheDocument()
    // The outer dialog stays mounted below, hidden from assistive technology while the nested one
    // is on top, so it is not reachable by role until that one closes.
    expect(screen.getByText("Outer body")).toBeInTheDocument()

    domClick(partOfCurrentDialog(CONFIRM_DIALOG_YES_BUTTON_TEST_ID))
    await waitFor(() => expect(results).toEqual(["nested:true"]))

    await waitFor(() => expect(getDialogs()).toHaveLength(1))
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument()

    domClick(screen.getByRole("button", { name: "Choose" }))
    domClick(partOfCurrentDialog(PROMPT_DIALOG_OK_BUTTON_TEST_ID))
    await waitFor(() =>
      expect(results).toEqual(["nested:true", { isSubmitted: true, value: "done" }]),
    )
  })
})

describe("useDialog", () => {
  test("throws outside a provider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined)
    try {
      expect(() => render(<OrphanCaller />)).toThrow(
        "useDialog must be used within a DialogProvider",
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  test("returns the same object and functions across renders", () => {
    const seen: DialogApi[] = []
    function Probe() {
      const [, forceRender] = React.useReducer((count: number) => count + 1, 0)
      seen.push(useDialog())
      return (
        <button type="button" onClick={forceRender}>
          Re-render
        </button>
      )
    }

    renderWithProvider(<Probe />)
    domClick(screen.getByRole("button", { name: "Re-render" }))

    expect(seen.length).toBeGreaterThan(1)
    for (const api of seen) {
      expect(api).toBe(seen[0])
      expect(api.confirm).toBe(seen[0]?.confirm)
    }
  })
})

describe("teardown", () => {
  test("resolves every outstanding promise as dismissed when the provider unmounts", async () => {
    function ThreeRequests() {
      const { alert, confirm, prompt } = useDialog()
      const run = () => {
        void alert("Notice").then(() => record("alert"))
        void confirm("Sure?").then((answer) => record(`confirm:${String(answer)}`))
        void prompt({ message: "Name" }).then((result) => record(result))
      }
      return (
        <button
          type="button"
          onClick={() => {
            void run()
          }}
        >
          Ask
        </button>
      )
    }

    const { unmount } = renderWithProvider(<ThreeRequests />)
    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(getDialogs()).toHaveLength(1)

    unmount()

    await waitFor(() => expect(results).toEqual(["alert", "confirm:false", { isSubmitted: false }]))
  })

  test("a body that throws still settles the caller's promise", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined)
    try {
      render(
        <TestBoundary>
          <DialogProvider>
            <CustomPromptButton<string>
              request={{ message: "Pick", body: () => <ExplodingBody /> }}
              label="Ask"
            />
          </DialogProvider>
        </TestBoundary>,
      )

      domClick(screen.getByRole("button", { name: "Ask" }))
      await waitFor(() => expect(results).toEqual([{ isSubmitted: false }]))
      expect(screen.getByText("Something broke")).toBeInTheDocument()
    } finally {
      consoleError.mockRestore()
    }
  })
})

describe("shared request fields", () => {
  test("passes size and lang through to the dialog surface", () => {
    renderWithProvider(
      <ConfirmButton request={{ message: "Vahvistus", size: "wide", lang: "fi" }} label="Ask" />,
    )

    domClick(screen.getByRole("button", { name: "Ask" }))
    const dialog = screen.getByTestId(DIALOG_PROVIDER_DIALOG_TEST_ID)
    expect(dialog).toHaveAttribute("lang", "fi")
    expect(getComputedStyle(dialog).getPropertyValue("--dialog-width-cap")).toBe("1200px")
  })

  test("renders no close button, leaving the actions as the only exits", () => {
    renderWithProvider(<ConfirmButton request="Sure?" label="Ask" />)

    domClick(screen.getByRole("button", { name: "Ask" }))
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument()
    expect(within(currentDialog()).getAllByRole("button")).toHaveLength(2)
  })
})
