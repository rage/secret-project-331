import { render, screen } from "@testing-library/react"
import { vi } from "vitest"

import type { UserItemAnswerChooseN } from "../../../../../../types/quizTypes/answer"
import type {
  ModelSolutionQuizItemChooseN,
  QuizItemOption,
} from "../../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemChooseN } from "../../../../../../types/quizTypes/publicSpec"
import ChooseNSubmission from "../ChooseN"

// ParsedText renders via dynamicImport (React.lazy); mock it so feedback text is synchronous.
vi.mock("../../../../ParsedText", () => ({
  __esModule: true,
  default: ({ text, addDotToEnd }: { text: string | null; addDotToEnd?: boolean }) => (
    <span>{addDotToEnd ? `${text}.` : text}</span>
  ),
}))

const makeModelSolutionOption = (id: string, title: string, correct: boolean): QuizItemOption => ({
  id,
  order: 0,
  correct,
  title,
  body: null,
  messagesOnModelSolution: [],
})

const publicItem: PublicSpecQuizItemChooseN = {
  type: "choose-n",
  id: "cn-1",
  order: 0,
  n: 2,
  title: "Pick the fruits",
  body: null,
  options: [
    { id: "o-1", order: 0, title: "Apple", body: null },
    { id: "o-2", order: 1, title: "Carrot", body: null },
    { id: "o-3", order: 2, title: "Banana", body: null },
  ],
}

const modelSolution: ModelSolutionQuizItemChooseN = {
  type: "choose-n",
  id: "cn-1",
  order: 0,
  n: 2,
  title: "Pick the fruits",
  body: null,
  messagesOnModelSolution: [],
  options: [
    makeModelSolutionOption("o-1", "Apple", true),
    makeModelSolutionOption("o-2", "Carrot", false),
    makeModelSolutionOption("o-3", "Banana", true),
  ],
}

// The user selected one correct option (Apple) and one incorrect option (Carrot).
const answer: UserItemAnswerChooseN = {
  type: "choose-n",
  quizItemId: "cn-1",
  selectedOptionIds: ["o-1", "o-2"],
  valid: true,
}

const renderSubmission = (
  solution: ModelSolutionQuizItemChooseN | null = modelSolution,
  feedback: unknown = null,
  { selected = answer.selectedOptionIds, n = 2 }: { selected?: string[]; n?: number } = {},
) =>
  render(
    <ChooseNSubmission
      public_quiz_item={{ ...publicItem, n }}
      quiz_direction="column"
      quiz_item_model_solution={solution}
      // oxlint-disable-next-line typescript/no-explicit-any
      quiz_item_answer_feedback={feedback as any}
      user_quiz_item_answer={{ ...answer, selectedOptionIds: selected }}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
    />,
  )

const lines = () =>
  Array.from(screen.getByRole("group", { name: "answer-summary" }).querySelectorAll("p")).map((p) =>
    p.textContent?.replaceAll("answer-summary-list-separator", "; ").replaceAll(/\s+/g, " "),
  )

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("ChooseN submission view accessibility", () => {
  it("emits no headings", () => {
    renderSubmission()
    expect(screen.queryAllByRole("heading")).toHaveLength(0)
  })

  it("labels a correctly selected option's icon as selected and correct (WCAG 1.1.1)", () => {
    renderSubmission()
    const apple = screen.getAllByText("Apple")[0]!.closest("div")
    expect(apple).not.toBeNull()
    expect(apple?.textContent).toContain("choose-n-selected")
    expect(apple?.textContent).toContain("your-answer-was-correct")
    expect(apple?.textContent).not.toContain("your-answer-was-not-correct")
  })

  it("labels an incorrectly selected option's icon as selected and incorrect (WCAG 1.1.1)", () => {
    renderSubmission()
    const carrot = screen.getAllByText("Carrot")[0]!.closest("div")
    expect(carrot).not.toBeNull()
    expect(carrot?.textContent).toContain("choose-n-selected")
    expect(carrot?.textContent).toContain("your-answer-was-not-correct")
  })

  it("does not add correctness text when there is no model solution", () => {
    renderSubmission(null)
    const apple = screen.getAllByText("Apple")[0]!.closest("div")
    expect(apple?.textContent).toContain("choose-n-selected")
    expect(apple?.textContent).not.toContain("your-answer-was-correct")
  })

  it("hides the decorative feedback icons from assistive technology", () => {
    const { container } = renderSubmission()
    const svgs = Array.from(container.querySelectorAll("svg"))
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg.closest('[aria-hidden="true"]')).not.toBeNull()
    }
  })

  it("marks a missed correct option as not selected, without a chip", () => {
    renderSubmission()
    const banana = screen.getByText("Banana").closest("div")!
    expect(banana.textContent).toContain("option-not-selected")
    expect(banana.textContent).not.toContain("option-result")
  })

  it("below n: you chose with verdicts, missed and incorrect options", () => {
    renderSubmission()
    expect(lines()).toEqual([
      "answer-summary-you-chose Apple answer-summary-verdict-correct; Carrot answer-summary-verdict-incorrect.",
      "answer-summary-missed Banana.",
      "answer-summary-incorrect-options Carrot.",
    ])
  })

  it("none correct chosen: still missed", () => {
    renderSubmission(modelSolution, null, { selected: ["o-2"] })
    expect(lines()[1]).toBe("answer-summary-missed Apple; Banana.")
  })

  it("at n correct choices: no missed line, only the you-chose and incorrect lines", () => {
    renderSubmission(modelSolution, null, { selected: ["o-1", "o-3"] })
    expect(lines()).toEqual([
      "answer-summary-you-chose Apple answer-summary-verdict-correct; Banana answer-summary-verdict-correct.",
      "answer-summary-incorrect-options Carrot.",
    ])
  })

  it("at n with a correct option left over: also correct", () => {
    renderSubmission(modelSolution, null, { selected: ["o-1"], n: 1 })
    expect(lines()[1]).toBe("answer-summary-also-correct Banana.")
  })

  it("has no summary without the key", () => {
    renderSubmission(null)
    expect(screen.queryByRole("group", { name: "answer-summary" })).not.toBeInTheDocument()
  })

  it("uses a neutral feedback border when correctness is unknown", () => {
    renderSubmission(null, {
      quiz_item_option_feedbacks: [
        { option_id: "o-1", this_option_was_correct: null, option_feedback: "Nice" },
      ],
    })
    expect(screen.getByText("Nice.").parentElement!).toHaveStyle({ borderLeftColor: "#b8b8c8" })
  })
})
