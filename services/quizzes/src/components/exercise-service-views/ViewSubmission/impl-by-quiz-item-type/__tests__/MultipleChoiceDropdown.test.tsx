import { render, screen, within } from "@testing-library/react"
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
  messagesOnModelSolution: [],
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
  messagesOnModelSolution: [],
  options: [
    makeModelSolutionOption("o-mercury", "Mercury", true),
    makeModelSolutionOption("o-venus", "Venus", false),
  ],
}

interface RenderOptions {
  selected?: string | null
  solution?: ModelSolutionQuizItemMultiplechoiceDropdown | null
  feedbacks?: {
    option_id: string
    this_option_was_correct: boolean | null
    option_feedback?: string
  }[]
}

const renderSubmission = ({
  selected = "o-mercury",
  solution = modelSolution,
  feedbacks,
}: RenderOptions = {}) =>
  render(
    <MultipleChoiceDropdownSubmission
      public_quiz_item={publicItem}
      quiz_direction="column"
      quiz_item_model_solution={solution}
      quiz_item_answer_feedback={
        feedbacks
          ? ({
              quiz_item_id: "mcd-1",
              quiz_item_feedback: null,
              quiz_item_option_feedbacks: feedbacks.map((f) => ({ option_feedback: null, ...f })),
              timeline_item_feedbacks: null,
              matrix_cell_feedbacks: null,
              matrix_score_breakdown: null,
              correctnessCoefficient: 1,
              // oxlint-disable-next-line typescript/no-explicit-any
            } as any)
          : null
      }
      user_quiz_item_answer={
        {
          type: "multiple-choice-dropdown",
          valid: true,
          quizItemId: "mcd-1",
          selectedOptionIds: selected ? [selected] : [],
        } satisfies UserItemAnswerMultiplechoiceDropdown
      }
      // oxlint-disable-next-line typescript/no-explicit-any
      user_information={{} as any}
    />,
  )

const box = () => screen.getByRole("group", { name: "Which planet is closest to the sun?" })

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("MultipleChoiceDropdown submission view", () => {
  it("shows the selection prefix and no chip when correctness is unknown", () => {
    renderSubmission({ solution: null })
    expect(box().textContent).toBe("option-selectedMercury")
  })

  it("shows the Correct chip for a correct selection and keeps the key line", () => {
    renderSubmission()
    expect(within(box()).getByText("option-result-correct")).toBeInTheDocument()
    expect(screen.getByText("correct-option", { exact: false })).toBeInTheDocument()
  })

  it("shows the Wrong chip for a wrong selection", () => {
    renderSubmission({ selected: "o-venus" })
    expect(within(box()).getByText("option-result-wrong")).toBeInTheDocument()
    expect(within(box()).getByText("option-selected")).toBeInTheDocument()
  })

  it("uses feedback when there is no key", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-mercury", this_option_was_correct: false }],
    })
    expect(within(box()).getByText("option-result-wrong")).toBeInTheDocument()
  })

  it("shows the answer placeholder without prefix or chip when nothing is selected", () => {
    renderSubmission({ selected: null })
    expect(box().textContent).toBe("answer")
  })

  it("renders a labelled group, not a select, and has no headings", () => {
    const { container } = renderSubmission()
    expect(container.querySelector("select")).toBeNull()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
    expect(screen.queryAllByRole("heading")).toHaveLength(0)
  })

  it("uses a neutral border on option feedback when correctness is unknown", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-mercury", this_option_was_correct: null, option_feedback: "Hi" }],
    })
    expect(screen.getByText("Hi").parentElement!).toHaveStyle({ borderLeftColor: "#b8b8c8" })
  })
})
