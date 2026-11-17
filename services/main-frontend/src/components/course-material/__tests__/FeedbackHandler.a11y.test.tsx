"use client"

import "@testing-library/jest-dom"
import "@/shared-module/common/test-utils/inertFocus"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider as JotaiProvider } from "jotai"

import { setupIntersectionObserverMock } from "@/shared-module/common/test-utils/mockIntersectionObserver"

import FeedbackHandler from "../FeedbackHandler"

// jsdom lacks IntersectionObserver, needed by TextArea's auto-resize.
beforeAll(setupIntersectionObserverMock)

const renderHandler = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <JotaiProvider>
        <main>
          <h1>Page</h1>
        </main>
        <FeedbackHandler courseId="c" pageId="p" courseHasChatbot={false} />
      </JotaiProvider>
    </QueryClientProvider>,
  )

// Lets react-aria's frame-delayed focus restore run before asserting where focus ended.
const settleFocus = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 100)
      }),
  )

const getTrigger = () => screen.getByRole("button", { name: "give-feedback", hidden: true })

const openType = async () => {
  const trigger = getTrigger()
  trigger.focus()
  fireEvent.click(trigger)
  await screen.findByRole("dialog")
  return trigger
}

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("FeedbackHandler", () => {
  it("keeps the trigger mounted but hidden while a dialog is open", async () => {
    renderHandler()
    expect(screen.getByTestId("give-feedback-button")).not.toHaveStyle("visibility: hidden")
    await openType()
    expect(screen.getByTestId("give-feedback-button")).toHaveStyle("visibility: hidden")
  })

  it("sits below dialogs: uses the sticky layer token, not a fixed z-index", () => {
    renderHandler()
    const css = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules).map((rule) => rule.cssText))
      .join("\n")
    expect(css).toContain("z-index: var(--layer-sticky)")
    expect(css).not.toMatch(/position: fixed;\s*bottom: 10px;[^}]*z-index: 1100/)
  })

  it("returns focus to the trigger after closing the written-feedback dialog with Escape", async () => {
    renderHandler()
    const trigger = await openType()
    fireEvent.click(screen.getByRole("button", { name: "written-feedback" }))
    const dialog = await screen.findByRole("dialog", { name: "written-feedback" })

    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await settleFocus()
    expect(document.activeElement).toBe(trigger)
  })

  it("keeps focus on the trigger after Escape when the page text is still selected", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <JotaiProvider>
          <main>
            <p className="course-material-block" id="block">
              Selected text
            </p>
          </main>
          <FeedbackHandler courseId="c" pageId="p" courseHasChatbot={false} />
        </JotaiProvider>
      </QueryClientProvider>,
    )
    // jsdom lacks Range layout.
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 10, 10)
    const paragraph = document.querySelector("#block") as HTMLElement
    const select = () => {
      window.getSelection()?.selectAllChildren(paragraph)
      act(() => {
        document.dispatchEvent(new Event("selectionchange"))
      })
    }
    select()
    fireEvent.click(await screen.findByRole("button", { name: "give-feedback" }))
    const dialog = await screen.findByRole("dialog")
    // Firefox keeps the page selection while focus is in the dialog.
    select()

    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await settleFocus()
    // Browsers fire selectionchange again after focus moves.
    act(() => {
      document.dispatchEvent(new Event("selectionchange"))
    })
    await settleFocus()

    expect(window.getSelection()?.toString()).toBe("")
    expect(screen.getByTestId("give-feedback-button")).not.toHaveStyle("visibility: hidden")
    expect(document.activeElement).toBe(getTrigger())
  })

  it("returns focus to the trigger after closing the improve panel with Close", async () => {
    renderHandler()
    const trigger = await openType()
    fireEvent.click(screen.getByRole("button", { name: "improve-material" }))
    const region = await screen.findByRole("region", { name: "improve-content-dialog" })

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    await waitFor(() => expect(region).not.toBeInTheDocument())
    await settleFocus()
    expect(document.activeElement).toBe(trigger)
  })

  it("closes the improve panel with Escape and returns focus to the trigger", async () => {
    renderHandler()
    const trigger = await openType()
    fireEvent.click(screen.getByRole("button", { name: "improve-material" }))
    const region = await screen.findByRole("region", { name: "improve-content-dialog" })

    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" })
    await waitFor(() => expect(region).not.toBeInTheDocument())
    await settleFocus()
    expect(document.activeElement).toBe(trigger)
  })

  it("focuses the improve panel heading when Improve material is chosen", async () => {
    renderHandler()
    await openType()
    fireEvent.click(screen.getByRole("button", { name: "improve-material" }))
    const region = await screen.findByRole("region", { name: "improve-content-dialog" })

    const heading = screen.getByRole("heading", { level: 2 })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(region).toContainElement(document.activeElement as HTMLElement)
    expect(region).toHaveAttribute("tabindex", "-1")
  })

  it("Ctrl+Shift+I moves focus back into the improve panel", async () => {
    renderHandler()
    await openType()
    fireEvent.click(screen.getByRole("button", { name: "improve-material" }))
    const region = await screen.findByRole("region", { name: "improve-content-dialog" })
    await waitFor(() => expect(region.contains(document.activeElement)).toBe(true))

    const active = document.activeElement as HTMLElement
    active.blur()
    expect(region.contains(document.activeElement)).toBe(false)

    act(() => {
      fireEvent.keyDown(document, { key: "I", ctrlKey: true, shiftKey: true })
    })
    expect(region.contains(document.activeElement)).toBe(true)
  })

  it("names each type option by its title and describes it with its description", async () => {
    renderHandler()
    await openType()
    const written = screen.getByRole("button", { name: "written-feedback" })
    expect(written).toHaveAccessibleDescription(
      "can-comment-on-portions-of-material-by-highlightig",
    )
    const improve = screen.getByRole("button", { name: "improve-material" })
    expect(improve).toHaveAccessibleDescription("improve-material-description")
    expect(improve.querySelector("h3")).toBeNull()
  })
})
