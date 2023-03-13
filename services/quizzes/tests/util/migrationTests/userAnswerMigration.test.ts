/* eslint-disable i18next/no-literal-string */
import { migratePrivateSpecQuiz } from "../../../src/util/migration/privateSpecQuiz"
import migrateQuizAnswer from "../../../src/util/migration/userAnswerSpec"
import { UserItemAnswer, UserItemAnswerCheckbox } from "../../../types/quizTypes/answer"
import {
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "../../../types/quizTypes/privateSpec"
import { QuizItem } from "../../../types/types"

import { compareUserItemAnswer } from "./utils/comparison"
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
import {
  generateUserAnswerForCheckbox,
  generateUserAnswerForChooseN,
  generateUserAnswerForClosedEnded,
  generateUserAnswerForEssay,
  generateUserAnswerForMatrix,
  generateUserAnswerForMultipleChoice,
  generateUserAnswerForScale,
  generateUserAnswerForTimeline,
  packUserAnswers,
} from "./utils/userAnswerGeneration"

describe("User answer", () => {
  test("migrates multiple-choice answers", () => {
    const correctOptions = 3
    const numberOfOptions = 5
    const quizOrder = 1
    const multipleChoiceQuizItem: QuizItem = generateMultipleChoicePrivateSpecQuiz(
      correctOptions,
      numberOfOptions,
      quizOrder,
    )
    const oldQuiz = packToPrivateSpecQuiz([multipleChoiceQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    // Create and compare user answers
    const matrixAnswer = generateUserAnswerForMultipleChoice(multipleChoiceQuizItem.id)
    const userAnswer = packUserAnswers([matrixAnswer])
    const migratedUserAnswer: UserItemAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("multiple-choice")
    compareUserItemAnswer(matrixAnswer, migratedUserAnswer)
  })

  test("migrates checkbox answers", () => {
    const checkboxQuizItem: QuizItem = generateCheckboxForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([checkboxQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemCheckbox = newQuiz.items[0] as PrivateSpecQuizItemCheckbox

    const checkboxAnswer = generateUserAnswerForCheckbox(newQuizItem.id)
    const userAnswer = packUserAnswers([checkboxAnswer])

    const migratedUserAnswer: UserItemAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("checkbox")
    // Checked field is boolean where as intData is a number.
    // The field tested manually here
    if (migratedUserAnswer.type == "checkbox") {
      const migratedCheckboxAnswer = migratedUserAnswer as UserItemAnswerCheckbox
      expect(migratedCheckboxAnswer.checked).toBe(checkboxAnswer.intData === 1 ? true : false)
    }
    compareUserItemAnswer(checkboxAnswer, migratedUserAnswer)
  })

  test("migrates essay answer", () => {
    const essayQuizItem: QuizItem = generateEssayForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([essayQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemEssay = newQuiz.items[0] as PrivateSpecQuizItemEssay

    const essayAnswer = generateUserAnswerForEssay(newQuizItem.id)
    const userAnswer = packUserAnswers([essayAnswer])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("essay")
    compareUserItemAnswer(essayAnswer, migratedUserAnswer)
  })

  test("migrates matrix answer", () => {
    const matrixQuizItem: QuizItem = generateMatrixForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([matrixQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemMatrix = newQuiz.items[0] as PrivateSpecQuizItemMatrix

    const matrixAnswer = generateUserAnswerForMatrix(newQuizItem.id)
    const userAnswer = packUserAnswers([matrixAnswer])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("matrix")
    compareUserItemAnswer(matrixAnswer, migratedUserAnswer)
  })

  test("migrates 'open' answer", () => {
    const closedEndedQuizItem: QuizItem = generateClosedEndedForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([closedEndedQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemClosedEndedQuestion = newQuiz
      .items[0] as PrivateSpecQuizItemClosedEndedQuestion

    const closedEndedAnswer = generateUserAnswerForClosedEnded(newQuizItem.id)
    const userAnswer = packUserAnswers([closedEndedAnswer])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("closed-ended-question")
    compareUserItemAnswer(closedEndedAnswer, migratedUserAnswer)
  })

  test("migrates scale answer", () => {
    const scaleQuizItem: QuizItem = generateScaleForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([scaleQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemScale = newQuiz.items[0] as PrivateSpecQuizItemScale

    const scaleAnswer = generateUserAnswerForScale(newQuizItem.id)
    const userAnswer = packUserAnswers([scaleAnswer])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("scale")
    compareUserItemAnswer(scaleAnswer, migratedUserAnswer)
  })

  test("migrates timeline answer", () => {
    const timelineQuizItem: QuizItem = generateTimelineForOlderPrivateSpecQuiz(1)
    const oldQuiz = packToPrivateSpecQuiz([timelineQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemTimeline = newQuiz.items[0] as PrivateSpecQuizItemTimeline

    const timelineAnswer = generateUserAnswerForTimeline(newQuizItem.id)
    const userAnswer = packUserAnswers([timelineAnswer])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("timeline")
    compareUserItemAnswer(timelineAnswer, migratedUserAnswer)
  })

  test("migrates clickable-multiple-choice answer", () => {
    const ChooseNQuizItem: QuizItem = generateChooseNForOlderPrivateSpecQuiz(1, 1)
    const oldQuiz = packToPrivateSpecQuiz([ChooseNQuizItem])
    const newQuiz = migratePrivateSpecQuiz(oldQuiz)

    const newQuizItem: PrivateSpecQuizItemChooseN = newQuiz.items[0] as PrivateSpecQuizItemChooseN

    const ChooseNAnswer = generateUserAnswerForChooseN(newQuizItem.id)
    const userAnswer = packUserAnswers([ChooseNAnswer])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, newQuiz).itemAnswers[0]
    expect(migratedUserAnswer.type).toBe("choose-n")
    compareUserItemAnswer(ChooseNAnswer, migratedUserAnswer)
  })

  test("migrates multiple answers", () => {
    const correctOptions = 3
    const numberOfOptions = 5

    const essayQuizItem = generateEssayForOlderPrivateSpecQuiz(1)
    const essayAnswer = generateUserAnswerForEssay(essayQuizItem.id)
    const checkboxQuizItem = generateCheckboxForOlderPrivateSpecQuiz(2)
    const checkboxAnswer = generateUserAnswerForCheckbox(checkboxQuizItem.id)
    const openQuizItem = generateClosedEndedForOlderPrivateSpecQuiz(3)
    const openAnswer = generateUserAnswerForClosedEnded(openQuizItem.id)
    const scaleQuizItem = generateScaleForOlderPrivateSpecQuiz(4)
    const scaleAnswer = generateUserAnswerForScale(scaleQuizItem.id)
    const matrixQuizItem = generateMatrixForOlderPrivateSpecQuiz(5)
    const matrixAnswer = generateUserAnswerForMatrix(matrixQuizItem.id)
    const timelineQuizItem = generateTimelineForOlderPrivateSpecQuiz(6)
    const timelineAnswer = generateUserAnswerForTimeline(timelineQuizItem.id)
    const multipleChoiceQuizItem = generateMultipleChoicePrivateSpecQuiz(
      correctOptions,
      numberOfOptions,
      7,
    )
    const multipleChoiceAnswer = generateUserAnswerForMultipleChoice(multipleChoiceQuizItem.id)
    const chooseNQuizItem = generateChooseNForOlderPrivateSpecQuiz(numberOfOptions, 8)
    const chooseNAnswer = generateUserAnswerForChooseN(chooseNQuizItem.id)

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

    const migratedPrivateSpecQuiz = migratePrivateSpecQuiz(oldQuiz)

    const userAnswer = packUserAnswers([
      essayAnswer,
      checkboxAnswer,
      openAnswer,
      scaleAnswer,
      matrixAnswer,
      timelineAnswer,
      multipleChoiceAnswer,
      chooseNAnswer,
    ])

    const migratedUserAnswer = migrateQuizAnswer(userAnswer, migratedPrivateSpecQuiz)

    expect(migratedUserAnswer.itemAnswers.map((item) => item.type)).toMatchObject([
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
