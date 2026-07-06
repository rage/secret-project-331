"use client"

import "@testing-library/jest-dom"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Provider as JotaiProvider, useSetAtom } from "jotai"
import React from "react"

import FeedbackDialog from "../FeedbackDialog"

import { currentlyOpenFeedbackDialogAtom } from "@/stores/course-material/materialFeedbackStore"

// jsdom does not implement IntersectionObserver (used by the shared TextAreaField)
class IntersectionObserverStub {
  observe() {
    // NOP
  }
  unobserve() {
    // NOP
  }
  disconnect() {
    // NOP
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).IntersectionObserver = IntersectionObserverStub

const OpenerHarness: React.FC = () => {
  const setCurrentlyOpenFeedbackDialog = useSetAtom(currentlyOpenFeedbackDialogAtom)
  return (
    <>
      {}
      <button onClick={() => setCurrentlyOpenFeedbackDialog("written")}>Open feedback</button>
      <FeedbackDialog courseId="course-id" pageId="page-id" />
    </>
  )
}

const renderHarness = () => {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <OpenerHarness />
      </JotaiProvider>
    </QueryClientProvider>,
  )
}

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("FeedbackDialog focus management (issue #54)", () => {
  it("moves focus into the dialog when it opens", async () => {
    renderHarness()
    const trigger = screen.getByText("Open feedback")
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = await screen.findByRole("dialog")
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })
  })

  it("restores focus to the trigger when the dialog closes", async () => {
    renderHarness()
    const trigger = screen.getByText("Open feedback")
    trigger.focus()
    fireEvent.click(trigger)
    await screen.findByRole("dialog")

    fireEvent.click(screen.getByRole("button", { name: "close" }))
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
    })
  })

  it("has an accessible name from its heading", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("Open feedback"))
    expect(await screen.findByRole("dialog", { name: "written-feedback" })).toBeInTheDocument()
  })

  it("uses a high-contrast focus ring instead of a low-contrast custom one", async () => {
    renderHarness()
    fireEvent.click(screen.getByText("Open feedback"))
    await screen.findByRole("dialog")

    const injectedCss = Array.from(document.styleSheets)
      .flatMap((sheet) => {
        try {
          return Array.from(sheet.cssRules).map((rule) => rule.cssText)
        } catch {
          return []
        }
      })
      .join("\n")

    // The shared green[600] (#1F6964) ring has > 3:1 contrast on the dialog background
    expect(injectedCss).toContain(":focus-visible")
    expect(injectedCss.toLowerCase()).toContain("#1f6964")
  })
})
