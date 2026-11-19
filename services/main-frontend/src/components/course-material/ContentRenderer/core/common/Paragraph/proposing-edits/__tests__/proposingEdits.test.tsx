"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"
import { Provider as JotaiProvider, useSetAtom } from "jotai"
import React from "react"

import { currentlyOpenFeedbackDialogAtom } from "@/stores/course-material/materialFeedbackStore"

import EditingParagraph from "../EditingParagraph"
import PreviewableParagraph from "../PreviewableParagraph"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("PreviewableParagraph", () => {
  it("is plain content, not a button or tab stop", () => {
    render(
      <PreviewableParagraph
        id="preview-1"
        content="The small fox"
        setEdits={jest.fn()}
        editedContent="The quick fox"
      />,
    )
    expect(screen.queryByRole("button")).toBeNull()
    const paragraph = screen.getByText(/quick/).closest("p")
    expect(paragraph).not.toHaveAttribute("tabindex")
    expect(paragraph).not.toHaveAttribute("role")
    expect(paragraph).toHaveTextContent("The smallquick fox")
  })
})

const OpenProposal: React.FC = () => {
  const setType = useSetAtom(currentlyOpenFeedbackDialogAtom)
  React.useEffect(() => {
    setType("proposed-edits")
  }, [setType])
  return null
}

const renderParagraph = (content: string) =>
  render(
    <JotaiProvider>
      <OpenProposal />
      <EditingParagraph id="block-1" data={{ attributes: { content, dropCap: false } }} />
    </JotaiProvider>,
  )

describe("EditingParagraph Edit button", () => {
  it("is described by the start of its paragraph", () => {
    renderParagraph("<strong>Photosynthesis</strong> turns light into sugar.")
    expect(screen.getByRole("button", { name: "edit" })).toHaveAccessibleDescription(
      "Photosynthesis turns light into sugar.",
    )
  })

  it("truncates long paragraphs in the description", () => {
    renderParagraph("word ".repeat(40))
    const description = screen
      .getByRole("button", { name: "edit" })
      .getAttribute("aria-describedby")
    // oxlint-disable-next-line unicorn/prefer-query-selector -- id comes from React useId and contains colons
    const text = document.getElementById(description ?? "")?.textContent ?? ""
    expect(text.length).toBeLessThanOrEqual(61)
    expect(text.endsWith("…")).toBe(true)
  })

  it("opens editing from the Edit button", () => {
    renderParagraph("Some text")
    fireEvent.click(screen.getByRole("button", { name: "edit" }))
    expect(screen.getByLabelText("edit-paragraph")).toBeInTheDocument()
  })
})
