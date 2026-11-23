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
  coefficient?: number
  score?: number
}

const renderSubmission = ({
  selected = "o-mercury",
  solution = modelSolution,
  feedbacks,
  coefficient = 1,
  score,
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
              correctnessCoefficient: coefficient,
              ...(score === undefined ? {} : { score }),
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

const lines = () =>
  Array.from(screen.getByRole("group", { name: "answer-summary" }).querySelectorAll("p")).map((p) =>
    p.textContent?.replaceAll("answer-summary-list-separator", "; ").replaceAll(/\s+/g, " "),
  )

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("MultipleChoiceDropdown submission view", () => {
  it("shows the selection prefix and no chip when correctness is unknown", () => {
    renderSubmission({ solution: null })
    expect(box().textContent).toBe("option-selectedMercury")
  })

  it("shows the Correct chip for a correct selection and the summary instead of the key line", () => {
    renderSubmission()
    expect(within(box()).getByText("option-result-correct")).toBeInTheDocument()
    expect(screen.queryByText("correct-option")).not.toBeInTheDocument()
    expect(lines()).toEqual([
      "answer-summary-you-chose Mercury answer-summary-verdict-correct.",
      "answer-summary-incorrect-options Venus.",
    ])
  })

  it("lists the correct options after a wrong selection", () => {
    renderSubmission({ selected: "o-venus" })
    expect(lines()).toEqual([
      "answer-summary-you-chose Venus answer-summary-verdict-incorrect.",
      "answer-summary-correct-options Mercury.",
      "answer-summary-incorrect-options Venus.",
    ])
  })

  it("with nothing selected shows lines 2 and 3 from the key", () => {
    renderSubmission({ selected: null })
    expect(lines()).toEqual([
      "answer-summary-correct-options Mercury.",
      "answer-summary-incorrect-options Venus.",
    ])
  })

  it("lists several correct options", () => {
    renderSubmission({
      selected: "o-venus",
      solution: {
        ...modelSolution,
        options: [
          makeModelSolutionOption("o-mercury", "Mercury", true),
          makeModelSolutionOption("o-venus", "Venus", true),
        ],
      },
    })
    expect(lines()[1]).toBe("answer-summary-also-correct Mercury.")
  })

  it("has no summary without the key", () => {
    renderSubmission({ solution: null })
    expect(screen.queryByRole("group", { name: "answer-summary" })).not.toBeInTheDocument()
  })

  it("shows the Incorrect chip for a wrong selection", () => {
    renderSubmission({ selected: "o-venus" })
    expect(within(box()).getByText("option-result-incorrect")).toBeInTheDocument()
    expect(within(box()).getByText("option-selected")).toBeInTheDocument()
  })

  it("uses feedback when there is no key", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-mercury", this_option_was_correct: false }],
    })
    expect(within(box()).getByText("option-result-incorrect")).toBeInTheDocument()
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
      coefficient: 0.5,
    })
    expect(screen.getByText("Hi").parentElement!).toHaveStyle({ borderLeftColor: "#b8b8c8" })
  })

  it("falls back to the item score when option correctness is null (fog of war)", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-mercury", this_option_was_correct: null }],
      coefficient: 1,
    })
    expect(within(box()).getByText("option-result-correct")).toBeInTheDocument()
  })

  it("shows Incorrect when option correctness is null and the item score is 0", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-mercury", this_option_was_correct: null }],
      coefficient: 0,
      score: 0,
    })
    expect(within(box()).getByText("option-result-incorrect")).toBeInTheDocument()
  })
})
