import { render, screen } from "@testing-library/react"

import type { UserItemAnswerChooseN } from "../../../../../../types/quizTypes/answer"
import type {
  ModelSolutionQuizItemChooseN,
  QuizItemOption,
} from "../../../../../../types/quizTypes/modelSolutionSpec"
import type { PublicSpecQuizItemChooseN } from "../../../../../../types/quizTypes/publicSpec"
import ChooseNSubmission from "../ChooseN"

const makeModelSolutionOption = (id: string, title: string, correct: boolean): QuizItemOption => ({
  id,
  order: 0,
  correct,
  title,
  body: null,
  messageAfterSubmissionWhenSelected: null,
  additionalCorrectnessExplanationOnModelSolution: null,
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
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
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

const renderSubmission = (solution: ModelSolutionQuizItemChooseN | null = modelSolution) =>
  render(
    <ChooseNSubmission
      public_quiz_item={publicItem}
      quiz_direction="column"
      quiz_item_model_solution={solution}
      quiz_item_answer_feedback={null}
      user_quiz_item_answer={answer}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      user_information={{} as any}
    />,
  )

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("ChooseN submission view accessibility", () => {
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
})
