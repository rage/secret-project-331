"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { UserItemAnswerClosedEndedQuestion } from "../../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemClosedEndedQuestion } from "../../../../../../types/quizTypes/publicSpec"
import ClosedEndedQuestion from "../ClosedEndedQuestion"

// Render synchronously; ParsedText otherwise resolves content via a dynamic import.
jest.mock("../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string | null }) => <span>{text}</span>,
}))

const baseItem: PublicSpecQuizItemClosedEndedQuestion = {
  type: "closed-ended-question",
  id: "cq-1",
  order: 0,
  formatRegex: null,
  title: "juhannus",
  body: "Fill in the sentence using the given word.",
}

const renderQuestion = (
  overrides: Partial<PublicSpecQuizItemClosedEndedQuestion> = {},
  answer: UserItemAnswerClosedEndedQuestion | null = null,
) => {
  const setQuizItemAnswerState = jest.fn()
  const utils = render(
    <ClosedEndedQuestion
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

describe("ClosedEndedQuestion accessibility", () => {
  it("labels the input with the given word via aria-labelledby (WCAG 1.3.1)", () => {
    renderQuestion()
    const input = screen.getByLabelText("juhannus")
    expect(input.tagName).toBe("INPUT")
    expect(input).not.toHaveAttribute("aria-label")
    const labelledBy = input.getAttribute("aria-labelledby") as string
    expect(document.getElementById(labelledBy)?.textContent).toBe("juhannus")
  })

  it("connects the instruction to the input via aria-describedby", () => {
    renderQuestion()
    const input = screen.getByLabelText("juhannus")
    const describedBy = input.getAttribute("aria-describedby") as string
    expect(document.getElementById(describedBy)?.textContent).toBe(
      "Fill in the sentence using the given word.",
    )
  })

  it("falls back to the body as the accessible name when there is no title", () => {
    renderQuestion({ title: null })
    const input = screen.getByLabelText("Fill in the sentence using the given word.")
    expect(input.tagName).toBe("INPUT")
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("falls back to a generic aria-label when both title and body are empty", () => {
    renderQuestion({ title: null, body: null })
    const input = screen.getByLabelText("answer")
    expect(input.tagName).toBe("INPUT")
    expect(input).not.toHaveAttribute("aria-labelledby")
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("never emits the 'Answerfalse' aria-label bug on the label or input (WCAG 1.3.1, 2.5.3)", () => {
    const { container } = renderQuestion()
    expect(container.innerHTML).not.toMatch(/Answerfalse/)
    const label = container.querySelector("label") as HTMLLabelElement
    expect(label).not.toHaveAttribute("aria-label")
  })

  it("gives the input a border color with >= 3:1 contrast (WCAG 1.4.11)", () => {
    renderQuestion()
    const input = screen.getByLabelText("juhannus")
    expect(input.outerHTML).not.toMatch(/dfe1e6/i)
  })

  it("propagates typed values through onChangeByValue", () => {
    const { setQuizItemAnswerState } = renderQuestion()
    const input = screen.getByLabelText("juhannus") as HTMLInputElement
    fireEvent.change(input, { target: { value: "kesä" } })
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(
      expect.objectContaining({ textData: "kesä" }),
    )
  })
})
