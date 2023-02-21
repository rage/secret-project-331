/* eslint-disable i18next/no-literal-string */
import migratePublicSpecQuiz from "../../../src/util/migration/publicSpecQuiz"
import {
  PublicSpecQuizItemCheckbox,
  PublicSpecQuizItemChooseN,
  PublicSpecQuizItemClosedEndedQuestion,
  PublicSpecQuizItemEssay,
  PublicSpecQuizItemMatrix,
  PublicSpecQuizItemScale,
  PublicSpecQuizItemTimeline,
} from "../../../types/quizTypes/publicSpec"
import { PublicQuizItem, PublicTimelineItem } from "../../../types/types"

import { comparePublicSpecQuizItem, expectPublicSpecMetadataToMatch } from "./utils/comparison"
import {
  generateCheckboxForOlderPublicSpecQuiz,
  generateChooseNForOlderPublicSpecQuiz,
  generateClosedEndedForOlderPublicSpecQuiz,
  generateEssayForOlderPublicSpecQuiz,
  generateMatrixForOlderPublicSpecQuiz,
  generateMultipleChoicePublicSpecQuiz,
  generateScaleForOlderPublicSpecQuiz,
  generateTimelineForOlderPublicSpecQuiz,
  packToPublicSpecQuiz,
} from "./utils/generation"

describe("public spec migration of quizzes", () => {
  test("migrates multiple-choice exercises", () => {
    const multipleChoiceItem = generateMultipleChoicePublicSpecQuiz(10, 5, 0)
    const oldPublicQuiz = packToPublicSpecQuiz([multipleChoiceItem])
    const migratedPublicQuiz = migratePublicSpecQuiz(oldPublicQuiz)
    const migratedMultipleChoiceItem = migratedPublicQuiz.items[0]

    expectPublicSpecMetadataToMatch(oldPublicQuiz, migratedPublicQuiz)
    comparePublicSpecQuizItem(migratedMultipleChoiceItem, multipleChoiceItem)
  })

  test("migrates checkbox exercise", () => {
    const checkboxQuizItem: PublicQuizItem = generateCheckboxForOlderPublicSpecQuiz(1)
    const oldQuiz = packToPublicSpecQuiz([checkboxQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemCheckbox = newQuiz.items[0] as PublicSpecQuizItemCheckbox

    expect(newQuizItem.type).toEqual("checkbox")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates essay exercise", () => {
    const essayQuizItem: PublicQuizItem = generateEssayForOlderPublicSpecQuiz(1)
    const oldQuiz = packToPublicSpecQuiz([essayQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemEssay = newQuiz.items[0] as PublicSpecQuizItemEssay

    expect(newQuizItem.type).toEqual("essay")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)

    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates matrix exercise", () => {
    const matrixQuizItem: PublicQuizItem = generateMatrixForOlderPublicSpecQuiz(1)
    const oldQuiz = packToPublicSpecQuiz([matrixQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemMatrix = newQuiz.items[0] as PublicSpecQuizItemMatrix

    expect(newQuizItem.type).toEqual("matrix")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates 'open' exercise", () => {
    const openQuizItem: PublicQuizItem = generateClosedEndedForOlderPublicSpecQuiz(1)
    const oldQuiz = packToPublicSpecQuiz([openQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemClosedEndedQuestion = newQuiz
      .items[0] as PublicSpecQuizItemClosedEndedQuestion

    expect(newQuizItem.type).toEqual("closed-ended-question")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates scale exercise", () => {
    const scaleQuizItem: PublicQuizItem = generateScaleForOlderPublicSpecQuiz(1)
    const oldQuiz = packToPublicSpecQuiz([scaleQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemScale = newQuiz.items[0] as PublicSpecQuizItemScale

    expect(newQuizItem.type).toEqual("scale")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
  })

  test("migrates timeline exercise", () => {
    const timelineQuizItem: PublicQuizItem = generateTimelineForOlderPublicSpecQuiz(1)
    const oldQuiz = packToPublicSpecQuiz([timelineQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemTimeline = newQuiz.items[0] as PublicSpecQuizItemTimeline

    // This will always be defined
    const timelineItems: PublicTimelineItem[] = oldQuizItem.timelineItems ?? []

    expect(newQuizItem.type).toEqual("timeline")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.timelineItems).toMatchObject(timelineItems)
  })

  test("migrates clickable-multiple-choice exercise", () => {
    const numberOfOptions = 5
    const quizOrder = 1
    const chooseNQuizItem: PublicQuizItem = generateChooseNForOlderPublicSpecQuiz(
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = packToPublicSpecQuiz([chooseNQuizItem])
    const newQuiz = migratePublicSpecQuiz(oldQuiz)

    const oldQuizItem: PublicQuizItem = oldQuiz.items[0]
    const newQuizItem: PublicSpecQuizItemChooseN = newQuiz.items[0] as PublicSpecQuizItemChooseN

    expect(newQuizItem.type).toEqual("choose-n")
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
    comparePublicSpecQuizItem(newQuizItem, oldQuizItem)
    expect(newQuizItem.options).toMatchObject(oldQuizItem.options)
  })

  test("migrates multiple quiz items", () => {
    const correctOptions = 3
    const numberOfOptions = 5

    const essayQuizItem = generateEssayForOlderPublicSpecQuiz(1)
    const checkboxQuizItem = generateCheckboxForOlderPublicSpecQuiz(2)
    const openQuizItem = generateClosedEndedForOlderPublicSpecQuiz(3)
    const scaleQuizItem = generateScaleForOlderPublicSpecQuiz(4)
    const matrixQuizItem = generateMatrixForOlderPublicSpecQuiz(5)
    const timelineQuizItem = generateTimelineForOlderPublicSpecQuiz(6)
    const multipleChoiceQuizItem = generateMultipleChoicePublicSpecQuiz(
      correctOptions,
      numberOfOptions,
      7,
    )
    const chooseNQuizItem = generateChooseNForOlderPublicSpecQuiz(numberOfOptions, 8)

    const oldQuiz = packToPublicSpecQuiz([
      essayQuizItem,
      checkboxQuizItem,
      openQuizItem,
      scaleQuizItem,
      matrixQuizItem,
      timelineQuizItem,
      multipleChoiceQuizItem,
      chooseNQuizItem,
    ])

    const newQuiz = migratePublicSpecQuiz(oldQuiz)
    expectPublicSpecMetadataToMatch(oldQuiz, newQuiz)
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
