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

// motion/react caches the media query for the module's life, so the hook is mocked per test.
let mockReduceMotion = false
jest.mock("motion/react", () => ({ useReducedMotion: () => mockReduceMotion }))
const setReducedMotion = (reduce: boolean) => {
  mockReduceMotion = reduce
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
