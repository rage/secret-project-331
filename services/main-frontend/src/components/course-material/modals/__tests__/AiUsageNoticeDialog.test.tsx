"use client"

import "@testing-library/jest-dom"
import "../../../../../tests/inert-focus"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React, { useState } from "react"

import AiUsageNoticeDialog from "../AiUsageNoticeDialog"

jest.mock("@/generated/course-material-api/sdk.generated", () => ({
  acknowledgeAiUsageNotice: jest.fn().mockResolvedValue({}),
}))

const Harness: React.FC = () => {
  const [open, setOpen] = useState(true)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <main>
        <h1>Course page</h1>
        <a href="#top">First link</a>
      </main>
      {open && (
        <AiUsageNoticeDialog
          courseId="course-id"
          aiPolicy="NotSet"
          courseMaterialAiInstructions={null}
          onClose={() => setOpen(false)}
        />
      )}
    </QueryClientProvider>
  )
}

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("AiUsageNoticeDialog (F-26)", () => {
  it("moves focus to the page heading after 'I understand'", async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByTestId("ai-usage-notice-acknowledge-button"))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    const heading = screen.getByRole("heading", { name: "Course page", level: 1 })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    expect(heading).toHaveAttribute("tabindex", "-1")
  })
})
