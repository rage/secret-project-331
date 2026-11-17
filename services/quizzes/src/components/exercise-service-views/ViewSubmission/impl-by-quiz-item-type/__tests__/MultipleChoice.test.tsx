import { render, screen, within } from "@testing-library/react"
import { vi } from "vitest"

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
  messagesOnModelSolution: [],
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

type Feedbacks = {
  option_id: string
  this_option_was_correct: boolean | null
  option_feedback?: string
}[]

interface RenderOptions {
  selected?: string[]
  multi?: boolean
  solution?: ModelSolutionQuizItemMultiplechoice | null
  feedbacks?: Feedbacks | null
  options?: PublicSpecQuizItemMultiplechoice["options"]
  coefficient?: number
  score?: number
  policy?: PublicSpecQuizItemMultiplechoice["multipleChoiceMultipleOptionsGradingPolicy"]
}

const renderSubmission = ({
  selected = ["o-1"],
  multi = false,
  solution = modelSolution,
  feedbacks = null,
  options,
  coefficient = 1,
  score,
  policy,
}: RenderOptions = {}) =>
  render(
    <MultipleChoiceSubmission
      public_quiz_item={{
        ...publicItem,
        allowSelectingMultipleOptions: multi,
        ...(policy ? { multipleChoiceMultipleOptionsGradingPolicy: policy } : {}),
        ...(options ? { options } : {}),
      }}
      quiz_direction="column"
      quiz_item_model_solution={solution}
      quiz_item_answer_feedback={
        feedbacks
          ? ({
              quiz_item_id: "mc-1",
              quiz_item_feedback: null,
              quiz_item_option_feedbacks: feedbacks.map((f) => ({
                option_feedback: null,
                ...f,
              })),
              timeline_item_feedbacks: null,
              matrix_cell_feedbacks: null,
              matrix_score_breakdown: null,
              correctnessCoefficient: coefficient,
              ...(score === undefined ? {} : { score }),
              // oxlint-disable-next-line typescript/no-explicit-any
            } as any)
          : null
      }
      user_quiz_item_answer={{ ...answer, selectedOptionIds: selected }}
      // oxlint-disable-next-line typescript/no-explicit-any
      user_information={{} as any}
    />,
  )

const items = () => screen.getAllByRole("listitem")

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
})

// react-i18next is mocked in src/test/setup.ts, so t() returns the translation key.
describe("MultipleChoice option states", () => {
  it("single, selected and correct: Selected prefix and Correct chip", () => {
    renderSubmission()
    const [first] = items()
    expect(within(first!).getByText("option-selected")).toBeInTheDocument()
    expect(within(first!).getByText("option-result-correct")).toBeInTheDocument()
  })

  it("single, selected and wrong: Incorrect chip; the unselected key row has no chip and no prefix", () => {
    renderSubmission({ selected: ["o-2"] })
    const [first, second] = items()
    expect(within(second!).getByText("option-result-incorrect")).toBeInTheDocument()
    expect(within(second!).getByText("option-selected")).toBeInTheDocument()
    expect(first!.textContent).toBe("Yes")
  })

  it("single, unselected wrong option has no chip and no prefix", () => {
    renderSubmission()
    const second = items()[1]!
    expect(second.textContent).toBe("No")
  })

  it("selected with no feedback and no key (exam) shows only the prefix", () => {
    renderSubmission({ solution: null })
    const [first, second] = items()
    expect(first!.textContent).toBe("option-selectedYes")
    expect(second!.textContent).toBe("No")
  })

  it("selected with feedback only gets a chip; unselected options get none", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-1", this_option_was_correct: false }],
    })
    const [first, second] = items()
    expect(within(first!).getByText("option-result-incorrect")).toBeInTheDocument()
    expect(second!.textContent).toBe("No")
  })

  it("multi: unselected options are prefixed and carry no chip", () => {
    const multiSolution: ModelSolutionQuizItemMultiplechoice = {
      ...modelSolution,
      options: [
        makeModelSolutionOption("o-1", "Yes", true),
        makeModelSolutionOption("o-2", "No", false),
        makeModelSolutionOption("o-3", "Maybe", true),
      ],
    }
    renderSubmission({
      multi: true,
      selected: ["o-1"],
      solution: multiSolution,
      options: [...publicItem.options, { id: "o-3", order: 2, title: "Maybe", body: null }],
    })
    const [first, second, third] = items()
    expect(first!.textContent).toBe("option-selectedYesoption-result-correct")
    expect(second!.textContent).toBe("option-not-selectedNo")
    expect(third!.textContent).toBe("option-not-selectedMaybe")
  })

  it("fogOfWar feedback without a key is neutral with no chip; with the key the chip comes from the key", () => {
    const { unmount } = renderSubmission({
      solution: null,
      coefficient: 0.5,
      feedbacks: [{ option_id: "o-1", this_option_was_correct: null }],
    })
    expect(items()[0]!.textContent).toBe("option-selectedYes")
    unmount()
    renderSubmission({
      feedbacks: [{ option_id: "o-1", this_option_was_correct: null }],
    })
    expect(within(items()[0]!).getByText("option-result-correct")).toBeInTheDocument()
  })

  it("shows no chip for an option missing from the key", () => {
    renderSubmission({ solution: { ...modelSolution, options: [] } })
    expect(items()[0]!.textContent).toBe("option-selectedYes")
  })

  it("puts the hidden prefix first in the text, hides the marker, has no radio or checkbox roles", () => {
    renderSubmission({ selected: ["o-2"] })
    const second = items()[1]!
    const text = within(second).getByText("No")
    const textDiv = text.parentElement!
    expect(textDiv.firstElementChild?.textContent).toBe("option-selected")
    expect(second.querySelector('[aria-hidden="true"]')).not.toBeNull()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.getAllByText("option-result-incorrect")).toHaveLength(1)
  })

  it("uses a neutral left border on option feedback when correctness is unknown", () => {
    renderSubmission({
      solution: null,
      feedbacks: [{ option_id: "o-1", this_option_was_correct: null, option_feedback: "Hello" }],
      coefficient: 0.5,
    })
    const message = screen.getByText("Hello.").parentElement!
    expect(message).toHaveStyle({ borderLeftColor: "#b8b8c8" })
  })
})

describe("MultipleChoice item score fallback", () => {
  const unknown: Feedbacks = [{ option_id: "o-1", this_option_was_correct: null }]

  it("single select: uses the item score when option correctness is null", () => {
    renderSubmission({ solution: null, feedbacks: unknown, coefficient: 1 })
    expect(within(items()[0]!).getByText("option-result-correct")).toBeInTheDocument()
  })

  it("single select: Incorrect when the item score is 0", () => {
    renderSubmission({ solution: null, feedbacks: unknown, coefficient: 0, score: 0 })
    expect(within(items()[0]!).getByText("option-result-incorrect")).toBeInTheDocument()
  })

  it("multi select: does not infer option correctness from the item score", () => {
    renderSubmission({ solution: null, feedbacks: unknown, multi: true, coefficient: 1 })
    expect(within(items()[0]!).queryByText("option-result-correct")).not.toBeInTheDocument()
  })
})

const summary = () => screen.queryByRole("group", { name: "answer-summary" })
const lines = () =>
  Array.from(summary()!.querySelectorAll("p")).map((p) =>
    p.textContent?.replaceAll("answer-summary-list-separator", "; ").replaceAll(/\s+/g, " "),
  )

const threeOptions = {
  options: [...publicItem.options, { id: "o-3", order: 2, title: "Maybe", body: null }],
}
const solutionOf = (flags: boolean[]): ModelSolutionQuizItemMultiplechoice => ({
  ...modelSolution,
  options: ["Yes", "No", "Maybe"].map((t, i) =>
    makeModelSolutionOption(`o-${i + 1}`, t, flags[i]!),
  ),
})

describe("MultipleChoice answer summary", () => {
  it("renders the summary outside the item group so groups are not nested", () => {
    renderSubmission()
    const itemGroup = screen.getByRole("group", { name: /Is the sky blue\?/ })
    expect(itemGroup).not.toContainElement(summary())
  })

  it("single, correct chosen: you chose with verdict, incorrect options, no also-correct line", () => {
    renderSubmission()
    expect(lines()).toEqual([
      "answer-summary-you-chose Yes answer-summary-verdict-correct.",
      "answer-summary-incorrect-options No.",
    ])
  })

  it("single, wrong chosen: correct options line", () => {
    renderSubmission({ selected: ["o-2"] })
    expect(lines()).toEqual([
      "answer-summary-you-chose No answer-summary-verdict-incorrect.",
      "answer-summary-correct-options Yes.",
      "answer-summary-incorrect-options No.",
    ])
  })

  it("single, correct chosen with another correct option: also correct", () => {
    renderSubmission({ ...threeOptions, solution: solutionOf([true, false, true]) })
    expect(lines()[1]).toBe("answer-summary-also-correct Maybe.")
  })

  it("single, nothing chosen: no you-chose line", () => {
    renderSubmission({ selected: [] })
    expect(lines()).toEqual([
      "answer-summary-correct-options Yes.",
      "answer-summary-incorrect-options No.",
    ])
  })

  it("multi default: missed line, listed in display order", () => {
    renderSubmission({
      ...threeOptions,
      multi: true,
      selected: ["o-2"],
      solution: solutionOf([true, false, true]),
    })
    expect(lines()).toEqual([
      "answer-summary-you-chose No answer-summary-verdict-incorrect.",
      "answer-summary-missed Yes; Maybe.",
      "answer-summary-incorrect-options No.",
    ])
  })

  it("multi, some-correct-none-incorrect: also correct with a correct choice, else correct options", () => {
    const base = {
      ...threeOptions,
      multi: true,
      solution: {
        ...solutionOf([true, false, true]),
        multipleChoiceMultipleOptionsGradingPolicy: "some-correct-none-incorrect" as const,
      },
      policy: "some-correct-none-incorrect" as const,
    }
    const { unmount } = renderSubmission({ ...base, selected: ["o-1"] })
    expect(lines()[1]).toBe("answer-summary-also-correct Maybe.")
    unmount()
    renderSubmission({ ...base, selected: ["o-2"] })
    expect(lines()[1]).toBe("answer-summary-correct-options Yes; Maybe.")
  })

  it("multi, everything chosen correctly and no wrong options: only the you-chose line", () => {
    renderSubmission({
      multi: true,
      selected: ["o-1", "o-2"],
      solution: solutionOf([true, true, true]),
    })
    expect(lines()).toEqual([
      "answer-summary-you-chose Yes answer-summary-verdict-correct; No answer-summary-verdict-correct.",
    ])
  })

  it("multi, nothing correct in the key: no line 2, line 3 lists every option", () => {
    renderSubmission({
      ...threeOptions,
      multi: true,
      selected: ["o-1"],
      solution: solutionOf([false, false, false]),
    })
    expect(lines()).toEqual([
      "answer-summary-you-chose Yes answer-summary-verdict-incorrect.",
      "answer-summary-incorrect-options Yes; No; Maybe.",
    ])
  })

  it("is absent without the key", () => {
    renderSubmission({ solution: null })
    expect(summary()).not.toBeInTheDocument()
  })

  it("is absent in fogOfWar without the key and present when the key is released", () => {
    const fog: Feedbacks = [{ option_id: "o-1", this_option_was_correct: null }]
    const { unmount } = renderSubmission({ solution: null, feedbacks: fog, coefficient: 0.5 })
    expect(summary()).not.toBeInTheDocument()
    unmount()
    renderSubmission({ feedbacks: fog })
    expect(summary()).toBeInTheDocument()
  })

  it("comes after the options list, outside it", () => {
    renderSubmission()
    const list = screen.getByRole("list")
    expect(list.compareDocumentPosition(summary()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(list).queryByRole("group")).not.toBeInTheDocument()
  })

  it("has one chip on the selected row only and no headings", () => {
    renderSubmission({ selected: ["o-2"] })
    expect(screen.getAllByText("option-result-incorrect")).toHaveLength(1)
    expect(screen.queryAllByRole("heading")).toHaveLength(0)
  })
})
