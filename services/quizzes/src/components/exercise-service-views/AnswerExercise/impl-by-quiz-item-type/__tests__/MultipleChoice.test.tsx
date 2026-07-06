"use client"

import "@testing-library/jest-dom"
import { render, screen } from "@testing-library/react"

import { UserItemAnswerMultiplechoice } from "../../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMultiplechoice } from "../../../../../../types/quizTypes/publicSpec"
import MultipleChoice from "../MultipleChoice"

const baseItem: PublicSpecQuizItemMultiplechoice = {
  type: "multiple-choice",
  id: "mc-1",
  order: 0,
  title: "Is the sky blue?",
  body: "Think about a clear day.",
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  allowSelectingMultipleOptions: false,

  optionDisplayDirection: "vertical",
  shuffleOptions: false,
  options: [
    { id: "o-1", order: 0, title: "Yes", body: null },
    { id: "o-2", order: 1, title: "No", body: null },
  ],
}

const renderMultipleChoice = (
  overrides: Partial<PublicSpecQuizItemMultiplechoice> = {},
  answer: UserItemAnswerMultiplechoice | null = null,
) => {
  const setQuizItemAnswerState = jest.fn()
  const utils = render(
    <MultipleChoice
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

describe("MultipleChoice answer view accessibility", () => {
  it("groups the options with the question as the group's accessible name (WCAG 1.3.1)", () => {
    renderMultipleChoice()
    const group = screen.getByRole("group", { name: /Is the sky blue\?/ })
    expect(group).toBeInTheDocument()
  })

  it("describes the group with the question body", () => {
    renderMultipleChoice()
    const group = screen.getByRole("group", { name: /Is the sky blue\?/ })
    expect(group).toHaveAccessibleDescription(/Think about a clear day\./)
  })

  it("contains the option buttons inside the labelled group", () => {
    renderMultipleChoice()
    const group = screen.getByRole("group", { name: /Is the sky blue\?/ })
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(group).toContainElement(button)
    }
  })

  it("exposes the selected option via aria-pressed", () => {
    renderMultipleChoice(
      {},
      {
        type: "multiple-choice",
        quizItemId: "mc-1",
        selectedOptionIds: ["o-1"],
        valid: true,
      },
    )
    expect(screen.getByRole("button", { name: "Yes", pressed: true })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "No", pressed: false })).toBeInTheDocument()
  })
})
