"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import StudiesSummary from "../StudiesSummary"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("StudiesSummary", () => {
  it("summarises completions and ECTS as one line under the tab heading", () => {
    render(<StudiesSummary totals={{ courses: 4, completions: 6, ects: 27 }} />)

    expect(screen.getByText("studies-summary-completions-and-ects")).toBeInTheDocument()
  })
})
