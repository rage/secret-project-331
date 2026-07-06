"use client"

import "@testing-library/jest-dom"

import { render, screen } from "@testing-library/react"

import ColorsIdentifier from "../ColorsIdentifier"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("Progress legend text values (issue #71)", () => {
  it("shows the point values as text next to the legend labels, not colour only", () => {
    render(<ColorsIdentifier studentPoints={7} requiredPoints={12} maxPoints={24} />)

    expect(screen.getByText("student-points: 7")).toBeInTheDocument()
    expect(screen.getByText("required-points: 12")).toBeInTheDocument()
    expect(screen.getByText("max-points: 24")).toBeInTheDocument()
  })

  it("omits the required-points legend when no required threshold exists", () => {
    render(<ColorsIdentifier studentPoints={7} maxPoints={24} />)

    expect(screen.getByText("student-points: 7")).toBeInTheDocument()
    expect(screen.queryByText(/required-points/)).not.toBeInTheDocument()
    expect(screen.getByText("max-points: 24")).toBeInTheDocument()
  })

  it("still renders plain labels when values are unavailable", () => {
    render(<ColorsIdentifier />)

    expect(screen.getByText("student-points")).toBeInTheDocument()
    expect(screen.getByText("max-points")).toBeInTheDocument()
  })
})
