import { describe, expect, it } from "vitest"

import type {
  ModelSolutionQuizV3,
  PrivateSpecQuizItemMultiplechoiceV3,
  PrivateSpecQuizV3,
  QuizItemOptionV3,
} from "../../../../types/quizTypes/v3"
import { migrateModelSolutionV3ToV4, migratePrivateSpecV3ToV4 } from "../v3ToV4"

// These tests guard the one lossy-looking step of the feedback redesign: v3's fixed message fields
// are folded into a visibility-tagged array. The risk the redesign has to avoid is silently
// dropping a teacher's existing feedback, so every old field is asserted to reappear.

const option = (over: Partial<QuizItemOptionV3>): QuizItemOptionV3 => ({
  id: "o1",
  order: 0,
  correct: true,
  title: "Option",
  body: null,
  messageAfterSubmissionWhenSelected: null,
  additionalCorrectnessExplanationOnModelSolution: null,
  ...over,
})

const multipleChoiceItem = (
  over: Partial<PrivateSpecQuizItemMultiplechoiceV3>,
): PrivateSpecQuizItemMultiplechoiceV3 => ({
  type: "multiple-choice",
  id: "i1",
  order: 0,
  shuffleOptions: false,
  allowSelectingMultipleOptions: false,
  fogOfWar: false,
  options: [],
  title: "Item",
  body: null,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
  sharedOptionFeedbackMessage: null,
  optionDisplayDirection: "horizontal",
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  ...over,
})

const privateSpec = (item: PrivateSpecQuizItemMultiplechoiceV3): PrivateSpecQuizV3 => ({
  version: "3",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  items: [item],
  title: null,
  body: null,
  quizItemDisplayDirection: "vertical",
  submitMessage: null,
})

const modelSolution = (item: ModelSolutionQuizV3["items"][number]): ModelSolutionQuizV3 => ({
  version: "3",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  title: null,
  body: null,
  submitMessage: null,
  items: [item],
})

describe("migratePrivateSpecV3ToV4 feedback preservation", () => {
  it("maps each fixed item message onto its matching visibility", () => {
    const migrated = migratePrivateSpecV3ToV4(
      privateSpec(
        multipleChoiceItem({
          successMessage: "Correct!",
          failureMessage: "Try again",
          messageOnModelSolution: "Here is why",
        }),
      ),
    )
    expect(migrated.items[0]?.feedbackMessages).toEqual([
      { visibility: "after-correct-answer", message: "Correct!" },
      // v3 showed the failure message for both partial and incorrect answers, so it becomes two rows.
      { visibility: "after-partially-correct-answer", message: "Try again" },
      { visibility: "after-incorrect-answer", message: "Try again" },
      { visibility: "on-model-solution", message: "Here is why" },
    ])
  })

  it("carries the quiz-level submit message onto after-any-answer", () => {
    const migrated = migratePrivateSpecV3ToV4({
      ...privateSpec(multipleChoiceItem({})),
      submitMessage: "Thanks for answering",
    })
    expect(migrated.feedbackMessages).toEqual([
      { visibility: "after-any-answer", message: "Thanks for answering" },
    ])
  })

  it("preserves both per-option feedback fields", () => {
    const migrated = migratePrivateSpecV3ToV4(
      privateSpec(
        multipleChoiceItem({
          options: [
            option({
              messageAfterSubmissionWhenSelected: "You picked this",
              additionalCorrectnessExplanationOnModelSolution: "This was the right pick",
            }),
          ],
        }),
      ),
    )
    const migratedItem = migrated.items[0]
    // The union widens `options` away from the multiple-choice branch; narrow before reading it.
    if (migratedItem?.type !== "multiple-choice") {
      throw new Error("expected a multiple-choice item")
    }
    expect(migratedItem.options[0]?.feedbackMessages).toEqual([
      { visibility: "when-selected-after-answer", message: "You picked this" },
      { visibility: "on-model-solution", message: "This was the right pick" },
    ])
  })

  it("drops empty and whitespace-only messages instead of creating blank rows", () => {
    const migrated = migratePrivateSpecV3ToV4(
      privateSpec(
        multipleChoiceItem({
          successMessage: "   ",
          failureMessage: "",
          messageOnModelSolution: null,
        }),
      ),
    )
    expect(migrated.items[0]?.feedbackMessages).toEqual([])
  })

  it("trims surrounding whitespace off preserved messages", () => {
    const migrated = migratePrivateSpecV3ToV4(
      privateSpec(multipleChoiceItem({ successMessage: "  Correct!  " })),
    )
    expect(migrated.items[0]?.feedbackMessages).toEqual([
      { visibility: "after-correct-answer", message: "Correct!" },
    ])
  })
})

describe("migrateModelSolutionV3ToV4 feedback preservation", () => {
  it("keeps the item and option model-solution messages", () => {
    const migrated = migrateModelSolutionV3ToV4(
      modelSolution({
        type: "multiple-choice",
        id: "i1",
        order: 0,
        shuffleOptions: false,
        allowSelectingMultipleOptions: false,
        options: [
          option({ additionalCorrectnessExplanationOnModelSolution: "Option explanation" }),
        ],
        title: "Item",
        body: null,
        successMessage: null,
        failureMessage: null,
        messageOnModelSolution: "Item explanation",
        sharedOptionFeedbackMessage: null,
        optionDisplayDirection: "horizontal",
        multipleChoiceMultipleOptionsGradingPolicy: "default",
      }),
    )
    const migratedItem = migrated.items[0]
    if (migratedItem?.type !== "multiple-choice") {
      throw new Error("expected a multiple-choice item")
    }
    expect(migratedItem.messagesOnModelSolution).toEqual(["Item explanation"])
    expect(migratedItem.options[0]?.messagesOnModelSolution).toEqual(["Option explanation"])
  })
})
