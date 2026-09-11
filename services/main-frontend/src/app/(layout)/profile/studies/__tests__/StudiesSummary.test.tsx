"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import StudiesSummary from "../StudiesSummary"

// The global mock returns the key verbatim; this one interpolates, so the formatted totals are visible.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      Object.entries(params ?? {}).reduce((text, [name, value]) => `${text} ${name}=${value}`, key),
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}))

describe("StudiesSummary", () => {
  it("leads with the credit total the student came for", () => {
    render(<StudiesSummary totals={{ courses: 4, completions: 6, ects: 27 }} />)

    expect(screen.getByText("ects-n n=27")).toBeInTheDocument()
    expect(screen.getByText("6")).toBeInTheDocument()
  })

  it("says nothing at all before the first completion", () => {
    render(<StudiesSummary totals={{ courses: 2, completions: 0, ects: 0 }} />)

    expect(screen.queryByRole("list")).not.toBeInTheDocument()
  })

  it("does not dress a whole number of credits up as a decimal", () => {
    render(<StudiesSummary totals={{ courses: 1, completions: 1, ects: 5 }} />)

    expect(screen.getByText("ects-n n=5")).toBeInTheDocument()
  })

  it("keeps a fractional credit total", () => {
    render(<StudiesSummary totals={{ courses: 1, completions: 1, ects: 7.5 }} />)

    expect(screen.getByText("ects-n n=7.5")).toBeInTheDocument()
  })
})
