/* eslint-disable i18next/no-literal-string */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

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
    const oldQuiz: Quiz = generateQuiz({
      id: "example-quiz",
    })
    const newQuiz: PrivateSpecQuiz = migratePrivateSpecQuiz(oldQuiz)!
    expect(isOldQuiz(oldQuiz))
    expect(!isOldQuiz(newQuiz))
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
    expect(newQuiz.items.length).toEqual(1)

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemMultiplechoice = newQuiz
      .items[0] as PrivateSpecQuizItemMultiplechoice
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates checkbox exercise", () => {
    const checkboxQuizItem: QuizItem = generateCheckboxForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([checkboxQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemCheckbox = newQuiz.items[0] as PrivateSpecQuizItemCheckbox

    expect(newQuizItem.type).toEqual("checkbox")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates essay exercise", () => {
    const essayQuizItem: QuizItem = generateEssayForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([essayQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemEssay = newQuiz.items[0] as PrivateSpecQuizItemEssay

    expect(newQuizItem.type).toEqual("essay")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)

    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates matrix exercise", () => {
    const matrixQuizItem: QuizItem = generateMatrixForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([matrixQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

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
    const openQuizItem: QuizItem = generateClosedEndedForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([openQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemClosedEndedQuestion = newQuiz
      .items[0] as PrivateSpecQuizItemClosedEndedQuestion

    expect(newQuizItem.type).toEqual("closed-ended-question")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates scale exercise", () => {
    const scaleQuizItem: QuizItem = generateScaleForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([scaleQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

    const oldQuizItem: QuizItem = oldQuiz.items[0]
    const newQuizItem: PrivateSpecQuizItemScale = newQuiz.items[0] as PrivateSpecQuizItemScale

    expect(newQuizItem.type).toEqual("scale")
    expectPrivateSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePrivateSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates timeline exercise", () => {
    const timelineQuizItem: QuizItem = generateTimelineForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([timelineQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

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
    const chooseNQuizItem: QuizItem = generateChooseNForOlderPrivateSpecQuiz(
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = packToPrivateSpecQuiz([chooseNQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)!

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
