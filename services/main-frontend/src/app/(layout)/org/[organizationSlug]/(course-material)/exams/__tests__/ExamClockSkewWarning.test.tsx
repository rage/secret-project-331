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

let mockOffsetMs = -2 * 60 * 60 * 1000
jest.mock("../useClockSkew", () => ({
  __esModule: true,
  default: () => ({ finalOffsetMs: mockOffsetMs }),
}))

const mockUseTime = jest.fn(() => new Date())
jest.mock("@/hooks/course-material/useTime", () => ({
  __esModule: true,
  default: () => mockUseTime(),
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

  it("subscribes to no clock without a significant skew", () => {
    mockOffsetMs = 30_000
    mockUseTime.mockClear()
    const { container } = render(<ExamClockSkewWarning />)
    expect(container).toBeEmptyDOMElement()
    expect(mockUseTime).not.toHaveBeenCalled()
  })
})
