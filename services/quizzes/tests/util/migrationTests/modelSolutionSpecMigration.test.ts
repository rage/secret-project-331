/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable i18next/no-literal-string */
import migrateModelSolutionSpecQuiz from "../../../src/util/migration/modelSolutionSpecQuiz"
import { OldModelSolutionQuizItem, OldQuizItemTimelineItem } from "../../../types/oldQuizTypes"
import {
  ModelSolutionQuizItemCheckbox,
  ModelSolutionQuizItemChooseN,
  ModelSolutionQuizItemClosedEndedQuestion,
  ModelSolutionQuizItemEssay,
  ModelSolutionQuizItemMatrix,
  ModelSolutionQuizItemScale,
  ModelSolutionQuizItemTimeline,
} from "../../../types/quizTypes/modelSolutionSpec"

import {
  compareModelSolutionSpecQuizItem,
  expectModelSolutionSpecMetadataToMatch,
} from "./utils/comparison"
import {
  generateCheckboxForOlderModelSolutionSpecQuiz,
  generateChooseNForOlderModelSolutionSpecQuiz,
  generateClosedEndedForOlderModelSolutionSpecQuiz,
  generateEssayForOlderModelSolutionSpecQuiz,
  generateMatrixForOlderModelSolutionSpecQuiz,
  generateMultipleChoiceModelSolutionSpecQuiz,
  generateScaleForOlderModelSolutionSpecQuiz,
  generateTimelineForOlderModelSolutionSpecQuiz,
  packToModelSolutionSpecQuiz,
} from "./utils/exerciseGeneration"

describe("model solution spec migration of quizzes", () => {
  test("migrates multiple-choice exercises", () => {
    const multipleChoiceItem = generateMultipleChoiceModelSolutionSpecQuiz(10, 5, 0)
    const oldModelSolutionQuiz = packToModelSolutionSpecQuiz([multipleChoiceItem])
    const migratedModelSolutionQuiz = migrateModelSolutionSpecQuiz(oldModelSolutionQuiz)!
    const migratedMultipleChoiceItem = migratedModelSolutionQuiz.items[0]

    expectModelSolutionSpecMetadataToMatch(oldModelSolutionQuiz, migratedModelSolutionQuiz)
    compareModelSolutionSpecQuizItem(migratedMultipleChoiceItem, multipleChoiceItem)
  })

  test("migrates checkbox exercise", () => {
    const checkboxQuizItem: OldModelSolutionQuizItem =
      generateCheckboxForOlderModelSolutionSpecQuiz(1)
    const oldQuiz = packToModelSolutionSpecQuiz([checkboxQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemCheckbox = newQuiz
      .items[0] as ModelSolutionQuizItemCheckbox

    expect(newQuizItem.type).toEqual("checkbox")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates essay exercise", () => {
    const essayQuizItem: OldModelSolutionQuizItem = generateEssayForOlderModelSolutionSpecQuiz(1)
    const oldQuiz = packToModelSolutionSpecQuiz([essayQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemEssay = newQuiz.items[0] as ModelSolutionQuizItemEssay

    expect(newQuizItem.type).toEqual("essay")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)

    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates matrix exercise", () => {
    const matrixQuizItem: OldModelSolutionQuizItem = generateMatrixForOlderModelSolutionSpecQuiz(1)
    const oldQuiz = packToModelSolutionSpecQuiz([matrixQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemMatrix = newQuiz.items[0] as ModelSolutionQuizItemMatrix

    expect(newQuizItem.type).toEqual("matrix")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates 'open' exercise", () => {
    const openQuizItem: OldModelSolutionQuizItem =
      generateClosedEndedForOlderModelSolutionSpecQuiz(1)
    const oldQuiz = packToModelSolutionSpecQuiz([openQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemClosedEndedQuestion = newQuiz
      .items[0] as ModelSolutionQuizItemClosedEndedQuestion

    expect(newQuizItem.type).toEqual("closed-ended-question")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates scale exercise", () => {
    const scaleQuizItem: OldModelSolutionQuizItem = generateScaleForOlderModelSolutionSpecQuiz(1)
    const oldQuiz = packToModelSolutionSpecQuiz([scaleQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemScale = newQuiz.items[0] as ModelSolutionQuizItemScale

    expect(newQuizItem.type).toEqual("scale")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates timeline exercise", () => {
    const timelineQuizItem: OldModelSolutionQuizItem =
      generateTimelineForOlderModelSolutionSpecQuiz(1)
    const oldQuiz = packToModelSolutionSpecQuiz([timelineQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemTimeline = newQuiz
      .items[0] as ModelSolutionQuizItemTimeline

    // This will always be defined
    const timelineItems: OldQuizItemTimelineItem[] = oldQuizItem.timelineItems ?? []

    expect(newQuizItem.type).toEqual("timeline")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.timelineItems).toMatchObject(timelineItems)
  })

  test("migrates clickable-multiple-choice exercise", () => {
    const numberOfOptions = 5
    const quizOrder = 1
    const chooseNQuizItem: OldModelSolutionQuizItem = generateChooseNForOlderModelSolutionSpecQuiz(
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = packToModelSolutionSpecQuiz([chooseNQuizItem])
    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!

    const oldQuizItem: OldModelSolutionQuizItem = oldQuiz.items[0]
    const newQuizItem: ModelSolutionQuizItemChooseN = newQuiz
      .items[0] as ModelSolutionQuizItemChooseN

    expect(newQuizItem.type).toEqual("choose-n")
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
    compareModelSolutionSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
  })

  test("migrates multiple quiz items", () => {
    const correctOptions = 3
    const numberOfOptions = 5

    const essayQuizItem = generateEssayForOlderModelSolutionSpecQuiz(1)
    const checkboxQuizItem = generateCheckboxForOlderModelSolutionSpecQuiz(2)
    const openQuizItem = generateClosedEndedForOlderModelSolutionSpecQuiz(3)
    const scaleQuizItem = generateScaleForOlderModelSolutionSpecQuiz(4)
    const matrixQuizItem = generateMatrixForOlderModelSolutionSpecQuiz(5)
    const timelineQuizItem = generateTimelineForOlderModelSolutionSpecQuiz(6)
    const multipleChoiceQuizItem = generateMultipleChoiceModelSolutionSpecQuiz(
      correctOptions,
      numberOfOptions,
      7,
    )
    const chooseNQuizItem = generateChooseNForOlderModelSolutionSpecQuiz(numberOfOptions, 8)

    const oldQuiz = packToModelSolutionSpecQuiz([
      essayQuizItem,
      checkboxQuizItem,
      openQuizItem,
      scaleQuizItem,
      matrixQuizItem,
      timelineQuizItem,
      multipleChoiceQuizItem,
      chooseNQuizItem,
    ])

    const newQuiz = migrateModelSolutionSpecQuiz(oldQuiz)!
    expectModelSolutionSpecMetadataToMatch(oldQuiz, newQuiz)
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
