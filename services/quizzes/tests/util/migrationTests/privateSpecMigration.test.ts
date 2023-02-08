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
  comparePrivateSpecQuizItem,
  createOldQuizFromQuizItems,
  expectPrivateSpecMetadataToMatch,
  generateCheckboxForOldQuiz,
  generateChooseNForOldQuiz,
  generateClosedEndedForOldQuiz,
  generateEssayForOldQuiz,
  generateMatrixForOldQuiz,
  generateMultipleChoiceForOldQuiz,
  generateScaleForOldQuiz,
  generateTimelineForOldQuiz,
} from "./testUtils"

describe("private spec", () => {
  test("distinguishes between old and new quiz", () => {
    const oldQuiz: Quiz = generateQuiz({
      id: "example-quiz",
    })
    const newQuiz: PrivateSpecQuiz = migratePrivateSpecQuiz(oldQuiz)
    expect(isOldQuiz(oldQuiz))
    expect(!isOldQuiz(newQuiz))
  })

  test("migrates multiple-choice exercises", () => {
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

    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    expect(newQuiz.items.length).toEqual(1)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemMultiplechoice = newQuiz
      .items[0] as PrivateSpecQuizItemMultiplechoice
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates checkbox exercise", () => {
    const checkboxQuizItem: QuizItem = generateCheckboxForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([checkboxQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemCheckbox = newQuiz.items[0] as PrivateSpecQuizItemCheckbox

    expect(newQuizItem.type).toEqual("checkbox")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates essay exercise", () => {
    const essayQuizItem: QuizItem = generateEssayForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([essayQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemEssay = newQuiz.items[0] as PrivateSpecQuizItemEssay

    expect(newQuizItem.type).toEqual("essay")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)

    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates matrix exercise", () => {
    const matrixQuizItem: QuizItem = generateMatrixForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([matrixQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemMatrix = newQuiz.items[0] as PrivateSpecQuizItemMatrix

    // This will always be defined
    const optionCells: string[][] = oldQuizItem.optionCells ?? []

    expect(newQuizItem.type).toEqual("matrix")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.optionCells).toMatchObject(optionCells)
  })

  test("migrates 'open' exercise", () => {
    const openQuizItem: QuizItem = generateClosedEndedForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([openQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemClosedEndedQuestion = newQuiz
      .items[0] as PrivateSpecQuizItemClosedEndedQuestion

    expect(newQuizItem.type).toEqual("closed-ended-question")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates scale exercise", () => {
    const scaleQuizItem: QuizItem = generateScaleForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([scaleQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemScale = newQuiz.items[0] as PrivateSpecQuizItemScale

    expect(newQuizItem.type).toEqual("scale")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates timeline exercise", () => {
    const timelineQuizItem: QuizItem = generateTimelineForOldQuiz(1)
    const oldQuiz = createOldQuizFromQuizItems([timelineQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemTimeline = newQuiz.items[0] as PrivateSpecQuizItemTimeline

    // This will always be defined
    const timelineItems: QuizItemTimelineItem[] = oldQuizItem.timelineItems ?? []

    expect(newQuizItem.type).toEqual("timeline")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.timelineItems).toMatchObject(timelineItems)
  })

  test("migrates clickable-multiple-choice exercise", () => {
    const numberOfOptions = 5
    const quizOrder = 1
    const chooseNQuizItem: QuizItem = generateChooseNForOldQuiz(numberOfOptions, quizOrder)
    const oldQuiz = createOldQuizFromQuizItems([chooseNQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemChooseN = newQuiz.items[0] as PrivateSpecQuizItemChooseN

    expect(newQuizItem.type).toEqual("choose-n")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
  })

  test("migrates multiple quiz items", () => {
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
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
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
