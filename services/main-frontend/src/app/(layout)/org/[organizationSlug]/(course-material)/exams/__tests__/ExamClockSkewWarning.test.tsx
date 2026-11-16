"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import ExamClockSkewWarning from "../ExamClockSkewWarning"

const mockTranslate = jest.fn((key: string, options?: Record<string, unknown>) =>
  options ? `${key}|${JSON.stringify(options)}` : key,
)

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: mockTranslate, i18n: { language: "en" } }),
}))

jest.mock("../useClockSkew", () => ({
  __esModule: true,
  default: () => ({ finalOffsetMs: -2 * 60 * 60 * 1000, sampleCount: 7, bestRttMs: 10 }),
}))

describe("ExamClockSkewWarning", () => {
  it("passes count to the plural-only duration keys", () => {
    render(<ExamClockSkewWarning />)
    expect(mockTranslate).toHaveBeenCalledWith("exam-clock-warning-duration-hours-only", {
      count: 2,
    })
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(
      "exam-clock-warning-title-fast",
    )
  })
})
