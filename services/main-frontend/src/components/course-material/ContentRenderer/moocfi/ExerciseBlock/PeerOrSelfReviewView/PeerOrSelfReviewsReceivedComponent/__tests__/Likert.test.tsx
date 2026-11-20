"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import Likert from "../Likert"

// react-i18next is globally mocked in tests/setup-jest.js so that t(key) returns the key
// (interpolation options are ignored). We therefore assert against the translation keys.

describe("Likert (peer/self review results view)", () => {
  it("exposes the selected option to assistive technology via role=img + aria-label", () => {
    render(<Likert question="Was the answer good?" index={0} content={4} />)

    const image = screen.getByRole("img")
    expect(image).toBeInTheDocument()
    expect(image).toHaveAccessibleName(expect.stringContaining("likert-scale-selected-answer"))
  })

  it("shows the question once, as a heading, and not again in the img label", () => {
    render(<Likert question="Was the answer good?" index={0} content={4} />)

    expect(
      screen.getByRole("heading", { level: 4, name: "question 1: Was the answer good?" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("img").getAttribute("aria-label")).not.toContain("Was the answer good?")
  })

  it("communicates when no option was selected", () => {
    render(<Likert question="Was the answer good?" index={2} content={null} />)

    const image = screen.getByRole("img")
    expect(image).toHaveAccessibleName(expect.stringContaining("likert-scale-no-answer"))
  })

  it("hides the decorative icon grid from the accessibility tree", () => {
    // role=img on the container means the inner icons aren't exposed as separate roles.
    render(<Likert question="Was the answer good?" index={0} content={2} />)
    expect(screen.getAllByRole("img")).toHaveLength(1)
  })
})
