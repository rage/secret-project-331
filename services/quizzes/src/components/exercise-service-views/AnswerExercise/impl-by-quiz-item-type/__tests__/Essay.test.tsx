"use client"

import "@testing-library/jest-dom"
import { act, fireEvent, render, screen } from "@testing-library/react"

import { UserItemAnswerEssay } from "../../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemEssay } from "../../../../../../types/quizTypes/publicSpec"
import Essay from "../Essay"

// Override the global identity i18n mock so interpolation options show up in the rendered string.
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key} ${JSON.stringify(options)}` : key,
    i18n: { changeLanguage: () => Promise.resolve() },
  }),
  Translation: ({ children }: { children: (t: (key: string) => string) => React.ReactNode }) =>
    children((key: string) => key),
}))

// jsdom has no IntersectionObserver; the auto-resizing textarea in TextAreaField relies on it.
beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).IntersectionObserver = MockIntersectionObserver
})

const baseItem: PublicSpecQuizItemEssay = {
  type: "essay",
  id: "essay-1",
  order: 0,
  minWords: 5,
  maxWords: 10,
  title: "What is your opinion?",
  body: "Explain your reasoning in full sentences.",
}

const makeAnswer = (textData: string): UserItemAnswerEssay => ({
  quizItemId: "essay-1",
  textData,
  valid: true,
  type: "essay",
})

const renderEssay = (
  overrides: Partial<PublicSpecQuizItemEssay> = {},
  answer: UserItemAnswerEssay | null = null,
) => {
  const setQuizItemAnswerState = jest.fn()
  const makeElement = (currentAnswer: UserItemAnswerEssay | null) => (
    <Essay
      quizDirection="column"
      quizItem={{ ...baseItem, ...overrides }}
      quizItemAnswerState={currentAnswer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
      setQuizItemAnswerState={setQuizItemAnswerState}
    />
  )
  const utils = render(makeElement(answer))
  // Simulates the parent updating the controlled answer state as the user types.
  const setText = (text: string) => utils.rerender(makeElement(makeAnswer(text)))
  return { ...utils, setQuizItemAnswerState, setText }
}

describe("Essay accessibility", () => {
  it("labels the textarea with the essay question via aria-labelledby (WCAG 1.3.1)", () => {
    renderEssay()
    const textarea = screen.getByLabelText(/What is your opinion\?/)
    expect(textarea.tagName).toBe("TEXTAREA")
    expect(textarea).not.toHaveAttribute("aria-label")
    const labelledBy = textarea.getAttribute("aria-labelledby")
    expect(labelledBy).toBeTruthy()
    const referenced = (labelledBy as string)
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ")
    expect(referenced).toContain("What is your opinion?")
    expect(referenced).toContain("Explain your reasoning in full sentences.")
  })

  it("only references rendered question parts when body is absent", () => {
    renderEssay({ body: null })
    const textarea = screen.getByLabelText(/What is your opinion\?/)
    const ids = (textarea.getAttribute("aria-labelledby") as string).split(" ")
    expect(ids).toHaveLength(1)
    expect(document.getElementById(ids[0])?.textContent).toBe("What is your opinion?")
  })

  it("gives the textarea a border color with >= 3:1 contrast", () => {
    const { container } = renderEssay()
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement
    expect(textarea.outerHTML).not.toMatch(/dfe1e6/i)
  })

  it("exposes a polite live region for the word count (WCAG 4.1.3)", () => {
    renderEssay()
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
  })

  it("updates the answer state as the user types", () => {
    const { setQuizItemAnswerState } = renderEssay()
    const textarea = screen.getByLabelText(/What is your opinion\?/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "one two three four five six seven" } })
    expect(setQuizItemAnswerState).toHaveBeenCalled()
  })
})

describe("Essay word count announcement debouncing", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const advance = (ms: number) => {
    act(() => {
      jest.advanceTimersByTime(ms)
    })
  }

  it("does not announce anything on initial render", () => {
    renderEssay()
    advance(20_000)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("does not announce while typing continues (the pause timer keeps resetting)", () => {
    const { setText } = renderEssay()
    setText("one")
    advance(9_000)
    setText("one two")
    advance(9_000)
    setText("one two three")
    advance(9_000)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("announces the count about 10 seconds after the last change", () => {
    const { setText } = renderEssay()
    setText("one two")
    advance(9_999)
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
    advance(1)
    expect(screen.getByRole("status")).toHaveTextContent("word-count-below-minimum")
    expect(screen.getByRole("status")).toHaveTextContent(/"count":2/)
  })

  it("announces the plain status when the count is within the allowed range", () => {
    const { setText } = renderEssay()
    setText("one two three four five six")
    advance(10_000)
    expect(screen.getByRole("status")).toHaveTextContent("word-count-status")
    expect(screen.getByRole("status")).toHaveTextContent(/"count":6/)
  })

  it("announces the above-maximum warning when the count is too high", () => {
    const { setText } = renderEssay({ maxWords: 3 })
    setText("one two three four five")
    advance(10_000)
    expect(screen.getByRole("status")).toHaveTextContent("word-count-above-maximum")
  })

  it("does not re-announce when the value has not changed after another pause", () => {
    const { setText } = renderEssay()
    setText("one two")
    advance(10_000)
    const announcedOnce = screen.getByRole("status").textContent
    expect(announcedOnce).toContain("word-count-below-minimum")
    setText("one two")
    advance(20_000)
    expect(screen.getByRole("status").textContent).toBe(announcedOnce)
  })

  it("announces again when the value changes after a pause", () => {
    const { setText } = renderEssay()
    setText("one two")
    advance(10_000)
    expect(screen.getByRole("status")).toHaveTextContent(/"count":2/)
    setText("one two three four five six")
    advance(10_000)
    expect(screen.getByRole("status")).toHaveTextContent("word-count-status")
    expect(screen.getByRole("status")).toHaveTextContent(/"count":6/)
  })
})
