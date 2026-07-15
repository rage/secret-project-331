import { vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

import type { UserItemAnswerMultiplechoice } from "../../../../../../types/quizTypes/answer"
import type {
  ModelSolutionQuizItemMultiplechoice,
  QuizItemOption,
} from "../../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemMultiplechoice } from "../../../../../../types/quizTypes/publicSpec"
import MultipleChoiceSubmission from "../MultipleChoice"

// ParsedText renders via dynamicImport (React.lazy); mock it so title/option text is present
// synchronously for the accessible-name assertions.
vi.mock("../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text }: { text: string | null }) => <span>{text}</span>,
}))

const makeModelSolutionOption = (id: string, title: string, correct: boolean): QuizItemOption => ({
  id,
  order: 0,
  correct,
  title,
  body: null,
  messageAfterSubmissionWhenSelected: null,
  additionalCorrectnessExplanationOnModelSolution: null,
})

const publicItem: PublicSpecQuizItemMultiplechoice = {
  type: "multiple-choice",
  id: "mc-1",
  order: 0,
  title: "Is the sky blue?",
  body: null,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  allowSelectingMultipleOptions: false,

  optionDisplayDirection: "vertical",
  shuffleOptions: false,
  options: [
    { id: "o-1", order: 0, title: "Yes", body: null },
    { id: "o-2", order: 1, title: "No", body: null },
  ],
}

const modelSolution: ModelSolutionQuizItemMultiplechoice = {
  type: "multiple-choice",
  id: "mc-1",
  order: 0,
  title: "Is the sky blue?",
  body: null,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  allowSelectingMultipleOptions: false,

  optionDisplayDirection: "vertical",
  shuffleOptions: false,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
  sharedOptionFeedbackMessage: null,
  options: [
    makeModelSolutionOption("o-1", "Yes", true),
    makeModelSolutionOption("o-2", "No", false),
  ],
}

const answer: UserItemAnswerMultiplechoice = {
  type: "multiple-choice",
  quizItemId: "mc-1",
  selectedOptionIds: ["o-1"],
  valid: true,
}

const renderSubmission = () =>
  render(
    <MultipleChoiceSubmission
      public_quiz_item={publicItem}
      quiz_direction="column"
      quiz_item_model_solution={modelSolution}
      quiz_item_answer_feedback={null}
      user_quiz_item_answer={answer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
    />,
  )

describe("MultipleChoice submission view accessibility", () => {
  it("groups the results under the question as the group's accessible name (WCAG 1.3.1)", () => {
    renderSubmission()
    expect(screen.getByRole("group", { name: /Is the sky blue\?/ })).toBeInTheDocument()
  })

  it("exposes the options as a list with one item per option", () => {
    renderSubmission()
    const list = screen.getByRole("list")
    expect(within(list).getAllByRole("listitem")).toHaveLength(2)
  })

  // react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
  it("marks the user's own selection with screen reader text", () => {
    renderSubmission()
    const [first, second] = screen.getAllByRole("listitem")
    expect(within(first).getByText("you-selected-this-option")).toBeInTheDocument()
    expect(within(second).queryByText("you-selected-this-option")).not.toBeInTheDocument()
  })

  it("conveys correct/incorrect state as text, not only color (WCAG 1.4.1)", () => {
    renderSubmission()
    const [first, second] = screen.getAllByRole("listitem")
    expect(within(first).getByText("correct-option")).toBeInTheDocument()
    expect(within(second).getByText("incorrect-option")).toBeInTheDocument()
  })
})
