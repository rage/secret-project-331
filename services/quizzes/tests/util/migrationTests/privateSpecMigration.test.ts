/* eslint-disable i18next/no-literal-string */
import { isOldQuiz } from "../../../src/util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "../../../src/util/migration/privateSpecQuiz"
import {
  PrivateSpecQuiz,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"
import { Quiz, QuizItem, QuizItemTimelineItem } from "../../../types/types"
import { generateQuiz } from "../../api/utils/quizGenerator"

import {
  createOldQuizFromQuizItems,
  expectMetadataToMatch,
  generateCheckboxForOldQuiz,
  generateChooseNForOldQuiz,
  generateClosedEndedForOldQuiz,
  generateEssayForOldQuiz,
  generateMatrixForOldQuiz,
  generateMultipleChoiceForOldQuiz,
  generateScaleForOldQuiz,
  generateTimelineForOldQuiz,
} from "./testUtils"

describe("migration of old quizzes", () => {
  test("distinguishes between old and new quiz", () => {
    const oldQuiz: Quiz = generateQuiz({
      id: "example-quiz",
    })
    const newQuiz: PrivateSpecQuiz = migratePrivateSpecQuiz(oldQuiz)
    expect(isOldQuiz(oldQuiz))
    expect(!isOldQuiz(newQuiz))
  })

  test("correctly migrates multiple-choice exercises", () => {
    const correctOptions = 3
    const numberOfOptions = 5
    const quizOrder = 1
    const multipleChoiceQuizItem: QuizItem = generateMultipleChoiceForOldQuiz(
      correctOptions,
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = createOldQuizFromQuizItems([multipleChoiceQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuiz.items.length).toEqual(1)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemMultiplechoice = newQuiz
      .items[0] as PrivateSpecQuizItemMultiplechoice
    expect(newQuizItem.type).toEqual("multiple-choice")
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.title).toEqual(oldQuizItem.title)
    expect(newQuizItem.body).toEqual(oldQuizItem.body)
    expect(newQuizItem.allowSelectingMultipleOptions).toEqual(oldQuizItem.multi)
    expect(newQuizItem.direction).toEqual(oldQuizItem.direction)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.sharedOptionFeedbackMessage).toEqual(oldQuizItem.sharedOptionFeedbackMessage)
    expect(newQuizItem.shuffleOptions).toEqual(oldQuizItem.shuffleOptions)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
    expect(newQuizItem.multipleChoiceMultipleOptionsGradingPolicy).toEqual(
      oldQuizItem.multipleChoiceMultipleOptionsGradingPolicy,
    )
  })

  test("correctly migrates checkbox exercise", () => {
    const checkboxQuizItem: QuizItem = generateCheckboxForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([checkboxQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemCheckbox = newQuiz.items[0] as PrivateSpecQuizItemCheckbox

    expect(newQuizItem.type).toEqual("checkbox")
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.body).toEqual(oldQuizItem.body)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.title).toEqual(oldQuizItem.title)
  })

  test("correctly migrates essay exercise", () => {
    const essayQuizItem: QuizItem = generateEssayForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([essayQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemEssay = newQuiz.items[0] as PrivateSpecQuizItemEssay

    expect(newQuizItem.type).toEqual("essay")
    expectMetadataToMatch(oldQuiz, newQuiz)

    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.title).toEqual(oldQuizItem.title)
    expect(newQuizItem.body).toEqual(oldQuizItem.body)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.minWords).toEqual(oldQuizItem.minWords)
    expect(newQuizItem.maxWords).toEqual(oldQuizItem.maxWords)
  })

  test("correctly migrates matrix exercise", () => {
    const matrixQuizItem: QuizItem = generateMatrixForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([matrixQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemMatrix = newQuiz.items[0] as PrivateSpecQuizItemMatrix

    // This will always be defined
    const optionCells: string[][] = oldQuizItem.optionCells ?? []

    expect(newQuizItem.type).toEqual("matrix")
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.optionCells).toMatchObject(optionCells)
  })

  test("correctly migrates 'open' exercise", () => {
    const openQuizItem: QuizItem = generateClosedEndedForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([openQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemClosedEndedQuestion = newQuiz
      .items[0] as PrivateSpecQuizItemClosedEndedQuestion

    expect(newQuizItem.type).toEqual("closed-ended-question")
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.body).toEqual(oldQuizItem.body)
    expect(newQuizItem.title).toEqual(oldQuizItem.title)
    expect(newQuizItem.formatRegex).toEqual(oldQuizItem.formatRegex)
    expect(newQuizItem.validityRegex).toEqual(oldQuizItem.validityRegex)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
  })

  test("correctly migrates scale exercise", () => {
    const scaleQuizItem: QuizItem = generateScaleForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([scaleQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemScale = newQuiz.items[0] as PrivateSpecQuizItemScale

    expect(newQuizItem.type).toEqual("scale")
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.title).toEqual(oldQuizItem.title)
    expect(newQuizItem.body).toEqual(oldQuizItem.body)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.maxLabel).toEqual(oldQuizItem.maxLabel)
    expect(newQuizItem.minLabel).toEqual(oldQuizItem.minLabel)
    expect(newQuizItem.maxValue).toEqual(oldQuizItem.maxValue)
    expect(newQuizItem.minValue).toEqual(oldQuizItem.minValue)
  })

  test("correctly migrates timeline exercise", () => {
    const timelineQuizItem: QuizItem = generateTimelineForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([timelineQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemTimeline = newQuiz.items[0] as PrivateSpecQuizItemTimeline

    // This will always be defined
    const timelineItems: QuizItemTimelineItem[] = oldQuizItem.timelineItems ?? []

    expect(newQuizItem.type).toEqual("timeline")
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.timelineItems).toMatchObject(timelineItems)
  })

  test("correctly migrates clickable-multiple-choice exercise", () => {
    const numberOfOptions = 5
    const quizOrder = 1
    const chooseNQuizItem: QuizItem = generateChooseNForOldQuiz(numberOfOptions, quizOrder)
    const oldQuiz = createOldQuizFromQuizItems([chooseNQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemChooseN = newQuiz.items[0] as PrivateSpecQuizItemChooseN

    expect(newQuizItem.type).toEqual("choose-n")
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuizItem.id).toEqual(oldQuizItem.id)
    expect(newQuizItem.order).toEqual(oldQuizItem.order)
    expect(newQuizItem.body).toEqual(oldQuizItem.body)
    expect(newQuizItem.title).toEqual(oldQuizItem.title)
    expect(newQuizItem.failureMessage).toEqual(oldQuizItem.failureMessage)
    expect(newQuizItem.successMessage).toEqual(oldQuizItem.successMessage)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
  })

  test("correctly migrates multiple quiz items", () => {
    const correctOptions = 3
    const numberOfOptions = 5

    const essayQuizItem = generateEssayForOldQuiz(1)
    const checkboxQuizItem = generateCheckboxForOldQuiz(2)
    const openQuizItem = generateClosedEndedForOldQuiz(3)
    const scaleQuizItem = generateScaleForOldQuiz(4)
    const matrixQuizItem = generateMatrixForOldQuiz(5)
    const timelineQuizItem = generateTimelineForOldQuiz(6)
    const multipleChoiceQuizItem = generateMultipleChoiceForOldQuiz(
      correctOptions,
      numberOfOptions,
      7,
    )
    const chooseNQuizItem = generateChooseNForOldQuiz(numberOfOptions, 8)

    const oldQuiz = createOldQuizFromQuizItems([
      essayQuizItem,
      checkboxQuizItem,
      openQuizItem,
      scaleQuizItem,
      matrixQuizItem,
      timelineQuizItem,
      multipleChoiceQuizItem,
      chooseNQuizItem,
    ])

    const newQuiz = migratePrivateSpecQuiz(oldQuiz)
    expectMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuiz.items.length).toEqual(8)
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
