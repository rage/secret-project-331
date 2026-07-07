"use client"

import "@testing-library/jest-dom"

import { fireEvent, render, screen, within } from "@testing-library/react"

import ExpandableContentInnerBlock from "../ExpandableContentInnerBlock"

// Stub out InnerBlocks so the test doesn't pull in the whole ContentRenderer.
jest.mock("@/components/course-material/ContentRenderer/util/InnerBlocks", () => ({
  __esModule: true,
  default: () => <div data-testid="inner-blocks" />,
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const props: any = {
  id: "expandable-inner",
  data: {
    name: "moocfi/expandable-content-inner-block",
    isValid: true,
    clientId: "expandable-inner",
    innerBlocks: [],
    attributes: { name: "Mild hearing problems" },
  },
}

describe("ExpandableContentInnerBlock accessibility (issue #68)", () => {
  it("renders the toggle as a button nested inside a heading (not the reverse)", () => {
    render(<ExpandableContentInnerBlock {...props} />)

    const heading = screen.getByRole("heading", { name: "Mild hearing problems" })
    expect(heading.tagName).toBe("H4")

    const button = within(heading).getByRole("button", { name: "Mild hearing problems" })
    expect(button.tagName).toBe("BUTTON")
    // A nested heading would strip the heading role.
    expect(button.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull()
  })

  it("reflects the collapsed/expanded state via aria-expanded and reveals a labelled region", () => {
    render(<ExpandableContentInnerBlock {...props} />)

    const button = screen.getByRole("button", { name: "Mild hearing problems" })
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("region")).not.toBeInTheDocument()

    fireEvent.click(button)

    expect(button).toHaveAttribute("aria-expanded", "true")
    const region = screen.getByRole("region", { name: "Mild hearing problems" })
    expect(button.getAttribute("aria-controls")).toBe(region.getAttribute("id"))
    expect(within(region).getByTestId("inner-blocks")).toBeInTheDocument()

    fireEvent.click(button)
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("region")).not.toBeInTheDocument()
  })
})
