"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import StudiesSummary from "../StudiesSummary"

// t is mocked in tests/setup-jest.js to return the translation key verbatim.
describe("StudiesSummary", () => {
  it("shows each total next to a text label", () => {
    render(<StudiesSummary totals={{ courses: 4, completions: 6, ects: 27 }} />)

    expect(screen.getByText("stat-courses")).toBeInTheDocument()
    expect(screen.getByText("stat-completions")).toBeInTheDocument()
    expect(screen.getByText("stat-ects-earned")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })

  it("does not dress a whole number of credits up as a decimal", () => {
    render(<StudiesSummary totals={{ courses: 1, completions: 1, ects: 5 }} />)

    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("keeps a fractional credit total", () => {
    render(<StudiesSummary totals={{ courses: 1, completions: 1, ects: 7.5 }} />)

    expect(screen.getByText("7.5")).toBeInTheDocument()
  })
})
