"use client"

import "@testing-library/jest-dom"
import { act, render } from "@testing-library/react"

import ImprovementExample from "../ImprovementExample"

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "improvement-example-incorrect-sentence": "The small brown fox jumps over the lazy dog.",
        "improvement-example-correct-sentence": "The quick brown fox jumps over the lazy dog.",
      })[key] ?? key,
  }),
}))

const setReducedMotion = (reduce: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia
}

// Each phase is scheduled by an effect after a render, so time has to pass in small acts.
const advance = (ms: number) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    act(() => {
      jest.advanceTimersByTime(100)
    })
  }
}

describe("ImprovementExample (F-42)", () => {
  afterEach(() => {
    jest.useRealTimers()
    // @ts-expect-error restore jsdom default, which has no matchMedia
    delete window.matchMedia
  })

  it("under reduced motion shows the corrected sentence and schedules no timers", () => {
    setReducedMotion(true)
    jest.useFakeTimers()
    const { container } = render(<ImprovementExample />)
    expect(container).toHaveTextContent("The quick brown fox")
    expect(jest.getTimerCount()).toBe(0)
  })

  it("plays once and then stops with nothing left scheduled", () => {
    setReducedMotion(false)
    jest.useFakeTimers()
    const { container } = render(<ImprovementExample />)
    expect(container).toHaveTextContent("The small brown fox")

    advance(5000)
    expect(container).toHaveTextContent("The quick brown fox")
    expect(jest.getTimerCount()).toBe(0)

    advance(30000)
    expect(container).toHaveTextContent("The quick brown fox")
    expect(jest.getTimerCount()).toBe(0)
  })
})
