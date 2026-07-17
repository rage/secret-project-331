import {
  migrateModelSolutionV3ToV4,
  migratePrivateSpecV3ToV4,
  migratePublicSpecV3ToV4,
  migrateUserAnswerV3ToV4,
} from "../../../src/util/migration/v3ToV4"
import type { PublicSpecQuizItem } from "../../../types/quizTypes/publicSpec"
import type {
  ModelSolutionQuizItemMultiplechoiceV3,
  ModelSolutionQuizV3,
  PrivateSpecQuizItemEssayV3,
  PrivateSpecQuizItemMultiplechoiceV3,
  PrivateSpecQuizItemV3,
  PrivateSpecQuizV3,
  PublicSpecQuizV3,
  QuizItemOptionV3,
  UserAnswerV3,
} from "../../../types/quizTypes/v3"

const essayItemV3 = (
  overrides: Partial<PrivateSpecQuizItemEssayV3> = {},
): PrivateSpecQuizItemEssayV3 => ({
  type: "essay",
  id: "essay-1",
  order: 0,
  minWords: 0,
  maxWords: 100,
  title: "Essay",
  body: null,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
  ...overrides,
})

const optionV3 = (overrides: Partial<QuizItemOptionV3> = {}): QuizItemOptionV3 => ({
  id: "option-1",
  order: 0,
  correct: true,
  title: "Option",
  body: null,
  messageAfterSubmissionWhenSelected: null,
  additionalCorrectnessExplanationOnModelSolution: null,
  ...overrides,
})

const multiplechoiceItemV3 = (
  overrides: Partial<PrivateSpecQuizItemMultiplechoiceV3> = {},
): PrivateSpecQuizItemMultiplechoiceV3 => ({
  type: "multiple-choice",
  shuffleOptions: false,
  id: "mc-1",
  order: 0,
  allowSelectingMultipleOptions: false,
  fogOfWar: false,
  options: [optionV3()],
  title: "MC",
  body: null,
  successMessage: null,
  failureMessage: null,
  messageOnModelSolution: null,
  sharedOptionFeedbackMessage: null,
  optionDisplayDirection: "vertical",
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  ...overrides,
})

const quizV3 = (
  items: PrivateSpecQuizItemV3[],
  submitMessage: string | null = null,
): PrivateSpecQuizV3 => ({
  version: "3",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  items,
  title: null,
  body: null,
  quizItemDisplayDirection: "vertical",
  submitMessage,
})

describe("v3 -> v4 private spec feedback migration", () => {
  test("version advances to 4", () => {
    expect(migratePrivateSpecV3ToV4(quizV3([])).version).toBe("4")
  })

  test("item successMessage becomes an after-correct-answer entry", () => {
    const migrated = migratePrivateSpecV3ToV4(
      quizV3([essayItemV3({ successMessage: "well done" })]),
    )
    expect(migrated.items[0]!.feedbackMessages).toEqual([
      { visibility: "after-correct-answer", message: "well done" },
    ])
  })

  test("item failureMessage becomes both partial and incorrect entries with the same text", () => {
    const migrated = migratePrivateSpecV3ToV4(
      quizV3([essayItemV3({ failureMessage: "try again" })]),
    )
    expect(migrated.items[0]!.feedbackMessages).toEqual([
      { visibility: "after-partially-correct-answer", message: "try again" },
      { visibility: "after-incorrect-answer", message: "try again" },
    ])
  })

  test("item messageOnModelSolution becomes an on-model-solution entry", () => {
    const migrated = migratePrivateSpecV3ToV4(
      quizV3([essayItemV3({ messageOnModelSolution: "the answer is blue" })]),
    )
    expect(migrated.items[0]!.feedbackMessages).toEqual([
      { visibility: "on-model-solution", message: "the answer is blue" },
    ])
  })

  test("null and empty-string message fields produce no entries", () => {
    const migrated = migratePrivateSpecV3ToV4(
      quizV3([
        essayItemV3({ successMessage: "", failureMessage: "   ", messageOnModelSolution: null }),
      ]),
    )
    expect(migrated.items[0]!.feedbackMessages).toEqual([])
  })

  test("sharedOptionFeedbackMessage is dropped entirely", () => {
    const migrated = migratePrivateSpecV3ToV4(
      quizV3([multiplechoiceItemV3({ sharedOptionFeedbackMessage: "SHARED_DEAD_FIELD" })]),
    )
    const item = migrated.items[0]!
    expect("sharedOptionFeedbackMessage" in item).toBe(false)
    expect(JSON.stringify(migrated)).not.toContain("SHARED_DEAD_FIELD")
  })

  test("option messages map to when-selected-after-answer and on-model-solution", () => {
    const migrated = migratePrivateSpecV3ToV4(
      quizV3([
        multiplechoiceItemV3({
          options: [
            optionV3({
              messageAfterSubmissionWhenSelected: "you picked this",
              additionalCorrectnessExplanationOnModelSolution: "here is why",
            }),
          ],
        }),
      ]),
    )
    const item = migrated.items[0]
    if (item?.type !== "multiple-choice") {
      throw new Error("expected a multiple-choice item")
    }
    expect(item.options[0]!.feedbackMessages).toEqual([
      { visibility: "when-selected-after-answer", message: "you picked this" },
      { visibility: "on-model-solution", message: "here is why" },
    ])
  })

  test("quiz submitMessage becomes one after-any-answer entry", () => {
    const migrated = migratePrivateSpecV3ToV4(quizV3([], "submitted!"))
    expect(migrated.feedbackMessages).toEqual([
      { visibility: "after-any-answer", message: "submitted!" },
    ])
  })

  test("a null quiz submitMessage produces no quiz-level entry", () => {
    expect(migratePrivateSpecV3ToV4(quizV3([], null)).feedbackMessages).toEqual([])
  })
})

const modelSolutionQuizV3 = (item: ModelSolutionQuizItemMultiplechoiceV3): ModelSolutionQuizV3 => ({
  version: "3",
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  items: [item],
  title: null,
  body: null,
  submitMessage: "was never read",
})

const modelSolutionMcItemV3 = (): ModelSolutionQuizItemMultiplechoiceV3 => ({
  type: "multiple-choice",
  shuffleOptions: false,
  id: "mc-1",
  order: 0,
  allowSelectingMultipleOptions: false,
  options: [optionV3({ additionalCorrectnessExplanationOnModelSolution: "option explanation" })],
  title: "MC",
  body: null,
  successMessage: "spoiler success",
  failureMessage: "spoiler failure",
  messageOnModelSolution: "item explanation",
  sharedOptionFeedbackMessage: null,
  optionDisplayDirection: "vertical",
  multipleChoiceMultipleOptionsGradingPolicy: "default",
})

describe("v3 -> v4 model solution feedback migration", () => {
  test("item and option produce messagesOnModelSolution arrays, quiz level is []", () => {
    const migrated = migrateModelSolutionV3ToV4(modelSolutionQuizV3(modelSolutionMcItemV3()))
    expect(migrated.version).toBe("4")
    const item = migrated.items[0]
    if (item?.type !== "multiple-choice") {
      throw new Error("expected a multiple-choice item")
    }
    expect(item.messagesOnModelSolution).toEqual(["item explanation"])
    expect(item.options[0]!.messagesOnModelSolution).toEqual(["option explanation"])
    expect(migrated.messagesOnModelSolution).toEqual([])
    // After-answer messages must not carry over into the model solution.
    const asString = JSON.stringify(migrated)
    expect(asString).not.toContain("spoiler success")
    expect(asString).not.toContain("spoiler failure")
  })
})

describe("v3 -> v4 public spec and answer migrations are pure version bumps", () => {
  test("public spec only changes the version literal", () => {
    const publicSpecV3: PublicSpecQuizV3 = {
      version: "3",
      items: [
        {
          type: "essay",
          id: "essay-1",
          order: 0,
          minWords: 0,
          maxWords: 100,
          title: "Essay",
          body: null,
        } as PublicSpecQuizItem,
      ],
      title: "Public",
      body: null,
      quizItemDisplayDirection: "vertical",
    }
    const migrated = migratePublicSpecV3ToV4(publicSpecV3)
    expect(migrated.version).toBe("4")
    expect({ ...migrated, version: "3" }).toEqual(publicSpecV3)
  })

  test("user answer only changes the version literal", () => {
    const answerV3: UserAnswerV3 = {
      version: "3",
      itemAnswers: [{ type: "essay", valid: true, quizItemId: "essay-1", textData: "blue" }],
    }
    const migrated = migrateUserAnswerV3ToV4(answerV3)
    expect(migrated.version).toBe("4")
    expect(migrated.itemAnswers).toEqual(answerV3.itemAnswers)
  })
})
