"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import Likert from "../Likert"

// react-i18next is globally mocked in tests/setup-jest.js so that t(key) returns the key
// (interpolation options are ignored). We therefore assert against the translation keys.

describe("Likert (peer/self review results view)", () => {
  it("exposes the selected option to assistive technology via role=img + aria-label", () => {
    render(<Likert question="Was the answer good?" index={0} content={4} />)

    // The selected answer must be programmatically available, not conveyed by styling alone.
    const image = screen.getByRole("img")
    expect(image).toBeInTheDocument()
    // The label combines the question and the selected answer (key from t()).
    expect(image).toHaveAccessibleName(expect.stringContaining("question 1: Was the answer good?"))
    expect(image).toHaveAccessibleName(expect.stringContaining("likert-scale-selected-answer"))
  })

  it("communicates when no option was selected", () => {
    render(<Likert question="Was the answer good?" index={2} content={null} />)

    const image = screen.getByRole("img")
    expect(image).toHaveAccessibleName(expect.stringContaining("likert-scale-no-answer"))
  })

  it("hides the decorative icon grid from the accessibility tree", () => {
    // With role=img on the container, the icon labels inside are not separately exposed as
    // interactive/queryable roles to assistive technology.
    render(<Likert question="Was the answer good?" index={0} content={2} />)
    // Only a single img node represents the whole scale.
    expect(screen.getAllByRole("img")).toHaveLength(1)
  })
})
