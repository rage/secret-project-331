import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { UserItemAnswerScale } from "../../../../../../types/quizTypes/answer"
import type { PublicSpecQuizItemScale } from "../../../../../../types/quizTypes/publicSpec"
import ScaleSubmission from "../Scale"

vi.mock("../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string | null }) => <span>{text}</span>,
}))

const item: PublicSpecQuizItemScale = {
  type: "scale",
  id: "scale-1",
  order: 0,
  minValue: 1,
  maxValue: 5,
  minLabel: "Not confident at all",
  maxLabel: "?",
  optionAnswers: null,
  title: "How confident are you?",
  body: null,
}

const answer: UserItemAnswerScale = {
  type: "scale",
  quizItemId: "scale-1",
  intData: 4,
  valid: true,
}

const renderView = (overrides: Partial<PublicSpecQuizItemScale> = {}) =>
  render(
    <ScaleSubmission
      public_quiz_item={{ ...item, ...overrides }}
      quiz_direction="column"
      quiz_item_model_solution={null}
      quiz_item_answer_feedback={null}
      user_quiz_item_answer={answer}
      // oxlint-disable-next-line typescript/no-explicit-any
      user_information={{} as any}
    />,
  )

describe("Scale submission view", () => {
  it("is a disabled radiogroup named by the title with the answer checked", () => {
    renderView()
    expect(screen.getByRole("radiogroup", { name: "How confident are you?" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio")).toHaveLength(5)
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "4" })).toBeDisabled()
  })

  it("renders real min labels and skips '?'", () => {
    renderView()
    expect(screen.getByText(/Not confident at all/)).toBeInTheDocument()
    expect(screen.queryByText(/\?$/, { selector: "div" })).not.toBeInTheDocument()
  })
})
