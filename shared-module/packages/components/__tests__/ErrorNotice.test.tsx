"use client"

import { screen, waitFor } from "@testing-library/react"

import { ErrorNotice } from "../src/components/ErrorNotice"
import { domClick, renderUi } from "./testUtils"

const writeText = jest.fn<Promise<void>, [string]>()

beforeEach(() => {
  writeText.mockReset()
  writeText.mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
})

/** The clipboard text of the last successful copy. */
async function copiedText(): Promise<string> {
  await waitFor(() => expect(writeText).toHaveBeenCalled())
  return writeText.mock.calls.at(-1)?.[0] ?? ""
}

function background(root: Element) {
  return getComputedStyle(root).background
}

function pressCopyReport() {
  domClick(screen.getByRole("button", { name: "Copy error report" }))
}

const apiFailure = {
  title: "Internal Server Error",
  message: "Saving the page failed",
  source: "at Object.save (page.ts:12:3)",
  status: 500,
}

/** The canonical api failure `common`'s fetch layer throws, which the notice narrows by name. */
function apiError(fields: Record<string, unknown>) {
  const error = new Error("Internal Server Error")
  error.name = "AppApiError"
  return Object.assign(error, { kind: "api", status: 500, ...fields })
}

describe("ErrorNotice", () => {
  test("shows the title and message, and nothing technical until asked", () => {
    renderUi(<ErrorNotice error={apiFailure} />)

    expect(screen.getByRole("heading", { name: "Internal Server Error" })).toBeInTheDocument()
    expect(screen.getByText("Saving the page failed")).toBeInTheDocument()
    expect(screen.queryByText("at Object.save (page.ts:12:3)")).not.toBeInTheDocument()
  })

  test("leaves out the disclosure when there is nothing technical to show", () => {
    renderUi(<ErrorNotice error="Something went wrong" />)

    expect(screen.getByRole("heading", { name: "Unexpected error" })).toBeInTheDocument()
    expect(screen.getByText("Something went wrong")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Technical details/ })).not.toBeInTheDocument()
  })

  test("reveals the details behind the disclosure", () => {
    renderUi(<ErrorNotice error={apiFailure} />)

    const trigger = screen.getByRole("button", { name: /Technical details/ })
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Status")).not.toBeInTheDocument()

    domClick(trigger)

    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("500")).toBeInTheDocument()
    expect(screen.getByText("at Object.save (page.ts:12:3)")).toBeInTheDocument()
  })

  test("copies the request id on its own, and shows it without expanding anything", async () => {
    renderUi(<ErrorNotice error={apiError({ requestId: "req-42" })} />)

    expect(screen.getByText("req-42")).toBeInTheDocument()

    domClick(screen.getByRole("button", { name: "Copy request ID" }))

    await expect(copiedText()).resolves.toBe("req-42")
  })

  test("copies a report carrying what the disclosure hides", async () => {
    renderUi(
      <ErrorNotice
        error={{
          type: "validation_error",
          message_key: "validation_error",
          message: "Input invalid",
          errors: [{ path: ["body", "email"], message: "Invalid email" }],
        }}
      />,
    )

    pressCopyReport()
    const report = await copiedText()

    expect(report).toContain("- body.email: Invalid email")
    expect(report).toContain("Message key: validation_error")
    expect(report).toContain("Type: validation_error")
    expect(report).toContain("Time: ")
  })

  test("puts the stack trace in the report, but only once the disclosure has been opened", async () => {
    const crash = new Error("Cannot read properties of undefined")
    crash.stack = "Error: Cannot read properties of undefined\n    at render (App.tsx:8:1)"
    renderUi(<ErrorNotice error={crash} />)

    pressCopyReport()
    expect(writeText).not.toHaveBeenCalled()

    domClick(screen.getByRole("button", { name: /Technical details/ }))
    pressCopyReport()
    const report = await copiedText()

    expect(report).toContain("Cannot read properties of undefined")
    expect(report).toContain("Stack trace:")
    expect(report).toContain("at render (App.tsx:8:1)")
  })

  test("announces assertively by default, politely on request, and not at all when off", () => {
    const { unmount } = renderUi(<ErrorNotice error={apiFailure} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Internal Server Error")
    unmount()

    const polite = renderUi(<ErrorNotice error={apiFailure} announce="polite" />)
    expect(screen.getByRole("status")).toHaveTextContent("Internal Server Error")
    polite.unmount()

    renderUi(<ErrorNotice error={apiFailure} announce="off" />)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("takes its severity from the error unless overridden", () => {
    const aborted = new Error("Aborted")
    aborted.name = "AbortError"

    const { container: info } = renderUi(<ErrorNotice error={aborted} />)
    const { container: error } = renderUi(<ErrorNotice error={apiFailure} />)
    const { container: forced } = renderUi(<ErrorNotice error={aborted} severity="error" />)

    expect(background(info.firstElementChild!)).not.toBe(background(error.firstElementChild!))
    expect(background(forced.firstElementChild!)).toBe(background(error.firstElementChild!))
  })

  test("links to the block the error came from", () => {
    renderUi(<ErrorNotice error={{ message: "Broken block", metadata: { block_id: "block-9" } }} />)

    expect(screen.getByRole("link", { name: "Go to error" })).toHaveAttribute("href", "#block-9")
  })

  test("uses the requested heading rank", () => {
    renderUi(<ErrorNotice error={apiFailure} headingLevel={3} />)

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Internal Server Error")
  })

  test("puts data-testid on the root", () => {
    const { container } = renderUi(<ErrorNotice error={apiFailure} data-testid="save-error" />)

    expect(screen.getByTestId("save-error")).toBe(container.firstElementChild)
  })
})
