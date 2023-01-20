/* eslint-disable i18next/no-literal-string */
import { isOldQuiz, migrateQuiz } from "../../src/util/quizMigration"
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
} from "../../types/quizTypes"
import { Quiz, QuizItem, QuizItemOption, QuizItemTimelineItem } from "../../types/types"
import { generateQuiz, generateQuizItem, generateQuizItemOption } from "../api/utils/quizGenerator"

/**
 * Expect metadata to match.
 *
 * @param oldQuiz Previous version of quiz
 * @param newQuiz Newer version of quiz
 * @param version Version of quiz. Defaults to "2"
 */
const expectMetadataToMatch = (oldQuiz: Quiz, newQuiz: PrivateSpecQuiz, version = "2") => {
  expect(newQuiz.id).toEqual(oldQuiz.id)
  expect(newQuiz.title).toEqual(oldQuiz.title)
  expect(newQuiz.submitMessage).toEqual(oldQuiz.submitMessage)
  expect(newQuiz.awardPointsEvenIfWrong).toEqual(oldQuiz.awardPointsEvenIfWrong)
  expect(newQuiz.version).toEqual(version)
}

/**
 * Create an old quiz from list of quiz items.
 *
 * @param items Array of quiz items
 * @returns Old Quiz
 */
const packIntoOldQuiz = (items: QuizItem[]) => {
  const oldQuiz = generateQuiz({
    id: "old-quiz-id",
    title: "old-quiz-title",
    body: "old-quiz-body",
    awardPointsEvenIfWrong: true,
    grantPointsPolicy: "grant_only_when_answer_fully_correct",
    submitMessage: "old-quiz-submit-message",
  })

  items.forEach((quizItem) => {
    oldQuiz.items.push(quizItem)
  })

  return oldQuiz
}

const generateMultipleChoiceForOldQuiz = (
  correctOptions: number,
  numberOfOptions: number,
  order: number,
): QuizItem => {
  const quizOptions: QuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: i < correctOptions,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generateQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}

const generateCheckboxForOldQuiz = (order: number): QuizItem => {
  return generateQuizItem({
    id: "checkbox-exercise",
    type: "checkbox",
    order,
    body: "checkbox-body",
    failureMessage: "checkbox-failure-message",
    successMessage: "checkbox-success-message",
    title: "checkbox-title",
  })
}

const generateEssayForOldQuiz = (order: number): QuizItem => {
  return generateQuizItem({
    id: "essay-exercise",
    type: "essay",
    order,
    title: "essay-title",
    body: "essay-body",
    failureMessage: "essay-failure-message",
    successMessage: "essay-success-message",
    maxWords: 500,
    minWords: 100,
  })
}

const generateMatrixForOldQuiz = (order: number): QuizItem => {
  return generateQuizItem({
    id: "matrix-exercise",
    type: "matrix",
    order,
    failureMessage: "matrix-failure-message",
    successMessage: "matrix-success-message",
    optionCells: [
      ["1", "0", "0"],
      ["0", "1", "0"],
      ["0", "0", "1"],
    ],
  })
}

const generateClosedEndedForOldQuiz = (order: number): QuizItem => {
  return generateQuizItem({
    id: "closed-ended-exercise",
    type: "open",
    order,
    body: "closed-ended-body",
    title: "closed-ended-title",
    formatRegex: "s{5}",
    validityRegex: "answer",
    successMessage: "closed-ended-failure-message",
    failureMessage: "closed-ended-success-message",
  })
}

const generateScaleForOldQuiz = (order: number): QuizItem => {
  return generateQuizItem({
    id: "scale-exercise",
    type: "scale",
    order,
    title: "scale-exercise-title",
    body: "scale-exercise-body",
    failureMessage: "scale-exercise-failure-message",
    successMessage: "scale-exercise-success-message",
    maxLabel: "max",
    minLabel: "min",
    maxValue: 100,
    minValue: 1,
  })
}

const generateTimelineForOldQuiz = (order: number): QuizItem => {
  return generateQuizItem({
    id: "timeline-exercise",
    type: "timeline",
    order,
    failureMessage: "timeline-failure-message",
    successMessage: "timeline-success-message",
    timelineItems: [
      {
        id: "0001",
        year: "2000",
        correctEventName: "event-name-2000",
        correctEventId: "0001",
      } as QuizItemTimelineItem,
    ],
  })
}

const generateChooseNForOldQuiz = (numberOfOptions: number, order: number): QuizItem => {
  const quizOptions: QuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: true,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generateQuizItem({
    id: "choose-N-exercise",
    type: "clickable-multiple-choice",
    order,
    body: "choose-N-body",
    title: "choose-N-title",
    failureMessage: "choose-N-failure-message",
    successMessage: "choose-N-success-message",
    options: quizOptions,
  })
}

describe("migration of old quizzes", () => {
  test("distinguishes between old and new quiz", () => {
    const oldQuiz: Quiz = generateQuiz({
      id: "example-quiz",
    })
    const newQuiz: PrivateSpecQuiz = migrateQuiz(oldQuiz)
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
    const oldQuiz = packIntoOldQuiz([multipleChoiceQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([checkboxQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([essayQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([matrixQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([openQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([scaleQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([timelineQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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
    const oldQuiz = packIntoOldQuiz([chooseNQuizItem])
    const newQuiz = migrateQuiz(oldQuiz)

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

    const oldQuiz = packIntoOldQuiz([
      essayQuizItem,
      checkboxQuizItem,
      openQuizItem,
      scaleQuizItem,
      matrixQuizItem,
      timelineQuizItem,
      multipleChoiceQuizItem,
      chooseNQuizItem,
    ])

    const newQuiz = migrateQuiz(oldQuiz)
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
