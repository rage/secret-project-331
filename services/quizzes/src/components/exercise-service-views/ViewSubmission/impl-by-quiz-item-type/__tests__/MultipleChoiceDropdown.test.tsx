import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { UserItemAnswerMultiplechoiceDropdown } from "../../../../../../types/quizTypes/answer"
import type {
  ModelSolutionQuizItemMultiplechoiceDropdown,
  QuizItemOption,
} from "../../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemMultiplechoiceDropdown } from "../../../../../../types/quizTypes/publicSpec"
import MultipleChoiceDropdownSubmission from "../MultipleChoiceDropdown"

// ParsedText renders via dynamicImport (React.lazy); mock it so any feedback text is present
// synchronously.
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

const publicItem: PublicSpecQuizItemMultiplechoiceDropdown = {
  type: "multiple-choice-dropdown",
  id: "mcd-1",
  order: 0,
  title: "Which planet is closest to the sun?",
  body: null,
  options: [
    { id: "o-mercury", order: 0, title: "Mercury", body: null },
    { id: "o-venus", order: 1, title: "Venus", body: null },
  ],
}

const modelSolution: ModelSolutionQuizItemMultiplechoiceDropdown = {
  type: "multiple-choice-dropdown",
  id: "mcd-1",
  order: 0,
  title: "Which planet is closest to the sun?",
  body: null,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
  options: [
    makeModelSolutionOption("o-mercury", "Mercury", true),
    makeModelSolutionOption("o-venus", "Venus", false),
  ],
}

const renderSubmission = (selectedOptionId: string) =>
  render(
    <MultipleChoiceDropdownSubmission
      public_quiz_item={publicItem}
      quiz_direction="column"
      quiz_item_model_solution={modelSolution}
      quiz_item_answer_feedback={{
        quiz_item_id: "mcd-1",
        quiz_item_feedback: null,
        quiz_item_option_feedbacks: null,
        timeline_item_feedbacks: null,
        correctnessCoefficient: selectedOptionId === "o-mercury" ? 1 : 0,
      }}
      user_quiz_item_answer={
        {
          type: "multiple-choice-dropdown",
          valid: true,
          quizItemId: "mcd-1",
          selectedOptionIds: [selectedOptionId],
        } satisfies UserItemAnswerMultiplechoiceDropdown
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
    />,
  )

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("MultipleChoiceDropdown submission view accessibility", () => {
  it("conveys a correct answer with a labelled icon, not only color (WCAG 1.4.1)", () => {
    renderSubmission("o-mercury")
    expect(screen.getByLabelText("your-answer-was-correct")).toBeInTheDocument()
    expect(screen.queryByLabelText("your-answer-was-not-correct")).not.toBeInTheDocument()
  })

  it("conveys an incorrect answer with a labelled icon, not only color (WCAG 1.4.1)", () => {
    renderSubmission("o-venus")
    expect(screen.getByLabelText("your-answer-was-not-correct")).toBeInTheDocument()
    expect(screen.queryByLabelText("your-answer-was-correct")).not.toBeInTheDocument()
  })
})
