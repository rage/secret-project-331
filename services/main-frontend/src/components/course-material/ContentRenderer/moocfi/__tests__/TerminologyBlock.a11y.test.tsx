"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import TerminologyBlock from "../TerminologyBlock"

// Stub out InnerBlocks; it pulls in the whole ContentRenderer.
jest.mock("@/components/course-material/ContentRenderer/util/InnerBlocks", () => ({
  __esModule: true,
  default: () => <div data-testid="inner-blocks" />,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeProps = (title: string): any => ({
  id: "terminology-block",
  data: {
    name: "moocfi/terminology",
    isValid: true,
    clientId: "terminology-block",
    innerBlocks: [],
    attributes: {
      title,
      primaryColor: "#333333",
      content: "",
      blockName: "Terminology",
    },
  },
})

describe("TerminologyBlock accessibility (issue #70)", () => {
  it("renders the term as a heading", () => {
    render(<TerminologyBlock {...makeProps("Photosynthesis")} />)

    const heading = screen.getByRole("heading")
    expect(heading.tagName).toBe("H2")
    expect(heading).toHaveTextContent("Photosynthesis")
  })

  it("does not emit an empty heading when the term is empty", () => {
    render(<TerminologyBlock {...makeProps("")} />)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  it("does not emit a heading for a whitespace-only term", () => {
    render(<TerminologyBlock {...makeProps("   ")} />)
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })
})
