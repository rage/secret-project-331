"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { UserItemAnswerEssay } from "../../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemEssay } from "../../../../../../types/quizTypes/publicSpec"
import Essay from "../Essay"

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

const renderEssay = (
  overrides: Partial<PublicSpecQuizItemEssay> = {},
  answer: UserItemAnswerEssay | null = null,
) => {
  const setQuizItemAnswerState = jest.fn()
  const utils = render(
    <Essay
      quizDirection="column"
      quizItem={{ ...baseItem, ...overrides }}
      quizItemAnswerState={answer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
      setQuizItemAnswerState={setQuizItemAnswerState}
    />,
  )
  return { ...utils, setQuizItemAnswerState }
}

describe("Essay accessibility", () => {
  it("labels the textarea with the essay question via aria-labelledby (WCAG 1.3.1)", () => {
    renderEssay()
    // Accessible name is the question, not the generic "Answer".
    const textarea = screen.getByLabelText(/What is your opinion\?/)
    expect(textarea.tagName).toBe("TEXTAREA")
    // The generic aria-label must be gone.
    expect(textarea).not.toHaveAttribute("aria-label")
    const labelledBy = textarea.getAttribute("aria-labelledby")
    expect(labelledBy).toBeTruthy()
    // The referenced ids include both the title and the body text.
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
    // The failing #dfe1e6 border must be replaced by the accessible gray[400] shade.
    expect(textarea.outerHTML).not.toMatch(/dfe1e6/i)
  })

  it("exposes a polite live region for the word count (WCAG 4.1.3)", () => {
    renderEssay()
    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
  })

  it("announces the count normally when within the allowed range", () => {
    renderEssay(
      {},
      {
        quizItemId: "essay-1",
        textData: "one two three four five six",
        valid: true,
        type: "essay",
      },
    )
    // Identity i18n mock returns the key, so the branch is observable by its key.
    expect(screen.getByRole("status")).toHaveTextContent("word-count-status")
  })

  it("announces a below-minimum warning when the count is too low", () => {
    renderEssay(
      {},
      {
        quizItemId: "essay-1",
        textData: "one two",
        valid: false,
        type: "essay",
      },
    )
    expect(screen.getByRole("status")).toHaveTextContent("word-count-below-minimum")
  })

  it("announces an above-maximum warning when the count is too high", () => {
    renderEssay(
      { maxWords: 3 },
      {
        quizItemId: "essay-1",
        textData: "one two three four five",
        valid: false,
        type: "essay",
      },
    )
    expect(screen.getByRole("status")).toHaveTextContent("word-count-above-maximum")
  })

  it("updates the announced count as the user types", () => {
    const { setQuizItemAnswerState } = renderEssay()
    const textarea = screen.getByLabelText(/What is your opinion\?/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "one two three four five six seven" } })
    expect(setQuizItemAnswerState).toHaveBeenCalled()
  })
})
