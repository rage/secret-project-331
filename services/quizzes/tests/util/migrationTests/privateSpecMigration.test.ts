import { migratePrivateSpecQuiz } from "../../../src/util/migration/privateSpecQuiz"
import { detectQuizVersion } from "../../../src/util/migration/versions"
import type { OldQuiz, OldQuizItemTimelineItem, QuizItem } from "../../../types/oldQuizTypes"
import type {
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"
import type {
  PrivateSpecQuizItemClosedEndedQuestionV2,
  PrivateSpecQuizV2,
} from "../../../types/quizTypes/v2"
import { oldGenerateQuiz } from "../../api/utils/oldQuizGenerator"
import { comparePrivateSpecQuizItem, expectPrivateSpecMetadataToMatch } from "./utils/comparison"
import {
  generateCheckboxForOlderPrivateSpecQuiz,
  generateChooseNForOlderPrivateSpecQuiz,
  generateClosedEndedForOlderPrivateSpecQuiz,
  generateEssayForOlderPrivateSpecQuiz,
  generateMatrixForOlderPrivateSpecQuiz,
  generateMultipleChoicePrivateSpecQuiz,
  generateScaleForOlderPrivateSpecQuiz,
  generateTimelineForOlderPrivateSpecQuiz,
  packToPrivateSpecQuiz,
} from "./utils/exerciseGeneration"

describe("private spec", () => {
  test("distinguishes between old and new quiz", () => {
    const oldQuiz: OldQuiz = oldGenerateQuiz({
      id: "example-quiz",
    })
    const newQuiz: PrivateSpecQuizV2 = migratePrivateSpecQuiz(oldQuiz)!
    expect(detectQuizVersion(oldQuiz)).toBe("1")
    expect(detectQuizVersion(newQuiz)).toBe("2")
  })

  test("migrates multiple-choice exercises", () => {
    const correctOptions = 3
    const numberOfOptions = 5
    const quizOrder = 1
    const multipleChoiceQuizItem: QuizItem = generateMultipleChoicePrivateSpecQuiz(
      correctOptions,
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = packToPrivateSpecQuiz([multipleChoiceQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuiz.items.length).toBe(1)

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemMultiplechoice = newQuiz
      .items[0] as PrivateSpecQuizItemMultiplechoice
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
  })

  test("migrates checkbox exercise", () => {
    const checkboxQuizItem: QuizItem = generateCheckboxForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([checkboxQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemCheckbox = newQuiz.items[0] as PrivateSpecQuizItemCheckbox

    expect(newQuizItem.type).toBe("checkbox")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates essay exercise", () => {
    const essayQuizItem: QuizItem = generateEssayForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([essayQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemEssay = newQuiz.items[0] as PrivateSpecQuizItemEssay

    expect(newQuizItem.type).toBe("essay")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)

    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates matrix exercise", () => {
    const matrixQuizItem: QuizItem = generateMatrixForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([matrixQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemMatrix = newQuiz.items[0] as PrivateSpecQuizItemMatrix

    // This will always be defined
    const optionCells: string[][] = oldQuizItem.optionCells ?? []

    expect(newQuizItem.type).toBe("matrix")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.optionCells).toMatchObject(optionCells)
  })

  test("migrates 'open' exercise", () => {
    const openQuizItem: QuizItem = generateClosedEndedForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([openQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemClosedEndedQuestionV2 = newQuiz
      .items[0] as PrivateSpecQuizItemClosedEndedQuestionV2

    expect(newQuizItem.type).toBe("closed-ended-question")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates scale exercise", () => {
    const scaleQuizItem: QuizItem = generateScaleForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([scaleQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemScale = newQuiz.items[0] as PrivateSpecQuizItemScale

    expect(newQuizItem.type).toBe("scale")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates timeline exercise", () => {
    const timelineQuizItem: QuizItem = generateTimelineForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([timelineQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemTimeline = newQuiz.items[0] as PrivateSpecQuizItemTimeline

    // This will always be defined
    const timelineItems: OldQuizItemTimelineItem[] = oldQuizItem.timelineItems ?? []

    expect(newQuizItem.type).toBe("timeline")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.timelineItems).toMatchObject(timelineItems)
  })

  test("migrates clickable-multiple-choice exercise", () => {
    const numberOfOptions = 5
    const quizOrder = 1
    const chooseNQuizItem: QuizItem = generateChooseNForOlderPrivateSpecQuiz(
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = packToPrivateSpecQuiz([chooseNQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]! // safe: quiz packed with exactly one item
    const newQuizItem: PrivateSpecQuizItemChooseN = newQuiz.items[0] as PrivateSpecQuizItemChooseN

    expect(newQuizItem.type).toBe("choose-n")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
  })

  test("migrates multiple quiz items", () => {
    const correctOptions = 3
    const numberOfOptions = 5

    const essayQuizItem = generateEssayForOlderPrivateSpecQuiz(1)
    const checkboxQuizItem = generateCheckboxForOlderPrivateSpecQuiz(2)
    const openQuizItem = generateClosedEndedForOlderPrivateSpecQuiz(3)
    const scaleQuizItem = generateScaleForOlderPrivateSpecQuiz(4)
    const matrixQuizItem = generateMatrixForOlderPrivateSpecQuiz(5)
    const timelineQuizItem = generateTimelineForOlderPrivateSpecQuiz(6)
    const multipleChoiceQuizItem = generateMultipleChoicePrivateSpecQuiz(
      correctOptions,
      numberOfOptions,
      7,
    )
    const chooseNQuizItem = generateChooseNForOlderPrivateSpecQuiz(numberOfOptions, 8)

    const oldQuiz = packToPrivateSpecQuiz([
      essayQuizItem,
      checkboxQuizItem,
      openQuizItem,
      scaleQuizItem,
      matrixQuizItem,
      timelineQuizItem,
      multipleChoiceQuizItem,
      chooseNQuizItem,
    ])

    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuiz.items.length).toBe(8)
    expect(newQuiz.items.map((item) => item.type)).toMatchObject([
      "essay",
      "checkbox",
      "closed-ended-question",
      "scale",
      "matrix",
      "timeline",
      "multiple-choice",
      "choose-n",
    ])
  })
})
