"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import StudiesSummary from "../StudiesSummary"

// The global mock returns the key verbatim; this one interpolates, so the formatted totals are visible.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params: Record<string, string>) =>
      Object.entries(params).reduce((text, [name, value]) => `${text} ${name}=${value}`, key),
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
}))

describe("StudiesSummary", () => {
  it("summarises completions and ECTS as one line", () => {
    render(<StudiesSummary totals={{ courses: 4, completions: 6, ects: 27 }} />)

    expect(
      screen.getByText("studies-summary-completions-and-ects completions=6 ects=27"),
    ).toBeInTheDocument()
  })

  it("does not dress a whole number of credits up as a decimal", () => {
    render(<StudiesSummary totals={{ courses: 1, completions: 1, ects: 5 }} />)

    expect(screen.getByText(/ects=5$/)).toBeInTheDocument()
  })

  it("keeps a fractional credit total", () => {
    render(<StudiesSummary totals={{ courses: 1, completions: 1, ects: 7.5 }} />)

    expect(screen.getByText(/ects=7\.5$/)).toBeInTheDocument()
  })
})
