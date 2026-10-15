import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { UserItemAnswerMultiplechoice } from "../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemMultiplechoice } from "../../../../../../types/quizTypes/publicSpec"
import MultipleChoice from "../MultipleChoice"

// ParsedText renders via dynamicImport (React.lazy); mock it so title/body text is present
// synchronously for the accessible-name assertions.
vi.mock("../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string | null }) => <span>{text}</span>,
}))

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
  const setQuizItemAnswerState = vi.fn()
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

  it("names the group with the body instead of an empty title element when title is null", () => {
    renderMultipleChoice({ title: null })
    const group = screen.getByRole("group", { name: /Think about a clear day\./ })
    // The group must not be labelled by the (empty) title element.
    const labelledBy = group.getAttribute("aria-labelledby") as string
    expect(labelledBy).toBeTruthy()
    for (const id of labelledBy.split(" ")) {
      // oxlint-disable-next-line unicorn/prefer-query-selector -- useId values aren't valid CSS selectors
      expect(document.getElementById(id)?.textContent).not.toBe("")
    }
  })

  it("falls back to a generic accessible name when both title and body are empty", () => {
    renderMultipleChoice({ title: null, body: null })
    // The identity i18n mock returns the key, so t("answer") renders as "answer".
    const group = screen.getByRole("group", { name: "answer" })
    expect(group).not.toHaveAttribute("aria-labelledby")
    expect(group).not.toHaveAttribute("aria-describedby")
  })

  it("exposes the selected option via aria-current and no aria-pressed in single-select mode", () => {
    renderMultipleChoice(
      { allowSelectingMultipleOptions: false },
      {
        type: "multiple-choice",
        quizItemId: "mc-1",
        selectedOptionIds: ["o-1"],
        valid: true,
      },
    )
    // Single-select options cannot be toggled off, so aria-pressed is the wrong semantic.
    const selected = screen.getByRole("button", { name: "Yes" })
    expect(selected).toHaveAttribute("aria-current", "true")
    const unselected = screen.getByRole("button", { name: "No" })
    expect(unselected).not.toHaveAttribute("aria-current")
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("aria-pressed")
    }
  })

  it("exposes the selected options via aria-pressed toggles in multi-select mode", () => {
    renderMultipleChoice(
      { allowSelectingMultipleOptions: true },
      {
        type: "multiple-choice",
        quizItemId: "mc-1",
        selectedOptionIds: ["o-1"],
        valid: true,
      },
    )
    expect(screen.getByRole("button", { name: "Yes", pressed: true })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "No", pressed: false })).toBeInTheDocument()
    // Multi-select toggles must not carry aria-current.
    for (const button of screen.getAllByRole("button")) {
      expect(button).not.toHaveAttribute("aria-current")
    }
  })
})
