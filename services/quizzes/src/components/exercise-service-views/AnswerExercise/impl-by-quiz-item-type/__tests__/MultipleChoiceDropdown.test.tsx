"use client"

import "@testing-library/jest-dom"
import { fireEvent, render, screen } from "@testing-library/react"

import { UserItemAnswerMultiplechoiceDropdown } from "../../../../../../types/quizTypes/answer"
import { PublicSpecQuizItemMultiplechoiceDropdown } from "../../../../../../types/quizTypes/publicSpec"
import MultipleChoiceDropdown from "../MultipleChoiceDropdown"

const baseItem: PublicSpecQuizItemMultiplechoiceDropdown = {
  type: "multiple-choice-dropdown",
  id: "mcd-1",
  order: 0,
  title: "Which planet is closest to the sun?",
  body: null,
  options: [
    { id: "option-mercury", order: 0, title: "Mercury", body: null },
    { id: "option-venus", order: 1, title: "Venus", body: null },
  ],
}

const renderDropdown = (
  overrides: Partial<PublicSpecQuizItemMultiplechoiceDropdown> = {},
  answer: UserItemAnswerMultiplechoiceDropdown | null = null,
) => {
  const setQuizItemAnswerState = jest.fn()
  const utils = render(
    <MultipleChoiceDropdown
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

describe("MultipleChoiceDropdown accessibility", () => {
  it("programmatically associates the visible title with the select (WCAG 1.3.1, 2.5.3)", () => {
    renderDropdown()
    const select = screen.getByLabelText("Which planet is closest to the sun?")
    expect(select.tagName).toBe("SELECT")
    // The name comes from a real <label for>, not from a generic aria-label.
    expect(select).not.toHaveAttribute("aria-label")
    const label = document.querySelector(`label[for="${select.id}"]`)
    expect(label).not.toBeNull()
    expect(label).toHaveTextContent("Which planet is closest to the sun?")
  })

  it("does not render the visible label as a heading", () => {
    renderDropdown()
    expect(screen.queryByRole("heading")).not.toBeInTheDocument()
  })

  it("falls back to naming the select by the body when there is no title", () => {
    renderDropdown({ title: null, body: "Pick the planet closest to the sun." })
    const select = screen.getByLabelText("Pick the planet closest to the sun.")
    expect(select.tagName).toBe("SELECT")
    expect(select).not.toHaveAttribute("aria-label")
  })

  it("keeps a generic accessible name when the item has no visible text at all", () => {
    renderDropdown({ title: null, body: null })
    // Identity i18n mock returns the key.
    const select = screen.getByLabelText("answer")
    expect(select.tagName).toBe("SELECT")
  })

  it("uses a border color with >= 3:1 contrast instead of the failing light gray", () => {
    renderDropdown()
    // Emotion inserts rules with insertRule, so read them from the CSSOM.
    const styleText = Array.from(document.styleSheets)
      .map((sheet) =>
        Array.from(sheet.cssRules)
          .map((rule) => rule.cssText)
          .join("\n"),
      )
      .join("\n")
    expect(styleText).toContain("#767b85")
    expect(styleText).not.toContain("#dfe1e6")
  })

  it("stores the selection when an option is chosen", () => {
    const { setQuizItemAnswerState } = renderDropdown()
    const select = screen.getByLabelText("Which planet is closest to the sun?")
    fireEvent.change(select, { target: { value: "option-venus" } })
    expect(setQuizItemAnswerState).toHaveBeenCalledWith(
      expect.objectContaining({ selectedOptionIds: ["option-venus"], valid: true }),
    )
  })
})
