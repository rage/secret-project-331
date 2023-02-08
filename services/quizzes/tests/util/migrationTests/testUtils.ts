/* eslint-disable i18next/no-literal-string */
import { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuiz, PrivateSpecQuizItem } from "../../../types/quizTypes/privateSpec"
import { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"
import {
  ModelSolutionQuiz as OldModelSolutionSpecQuiz,
  PublicQuiz,
  Quiz,
  QuizItem,
  QuizItemOption,
  QuizItemTimelineItem,
} from "../../../types/types"
import {
  generateQuiz,
  generateQuizItem,
  generateQuizItemOption,
} from "../../api/utils/quizGenerator"

const QUIZ_VERSION = "2"

/**
 * Check if all fields excluding quiz items match for private spec quiz
 * @param oldQuiz Old private spec quiz
 * @param privateSpecQuiz New private spec quiz
 * @param version Version of the private spec quiz
 */
const expectPrivateSpecMetadataToMatch = (
  oldQuiz: Quiz,
  privateSpecQuiz: PrivateSpecQuiz,
  version = QUIZ_VERSION,
) => {
  expect(privateSpecQuiz.id).toEqual(oldQuiz.id)
  expect(privateSpecQuiz.title).toEqual(oldQuiz.title)
  expect(privateSpecQuiz.body).toEqual(oldQuiz.body)
  expect(privateSpecQuiz.submitMessage).toEqual(oldQuiz.submitMessage)
  expect(privateSpecQuiz.awardPointsEvenIfWrong).toEqual(oldQuiz.awardPointsEvenIfWrong)
  expect(privateSpecQuiz.grantPointsPolicy).toEqual(oldQuiz.grantPointsPolicy)
  expect(privateSpecQuiz.version).toEqual(version)
}

/**
 * Check if all fields excluding quiz items match for public spec quiz
 * @param oldQuiz Old public spec quiz
 * @param publicSpecQuiz New public spec quiz
 * @param version Version of the public spec quiz
 */
const expectPublicSpecMetadataToMatch = (
  oldQuiz: PublicQuiz,
  publicSpecQuiz: PublicSpecQuiz,
  version = QUIZ_VERSION,
) => {
  expect(publicSpecQuiz.id).toEqual(oldQuiz.id)
  expect(publicSpecQuiz.title).toEqual(oldQuiz.title)
  expect(publicSpecQuiz.version).toEqual(version)
  expect(publicSpecQuiz.body).toEqual(oldQuiz.body)
}

/**
 * Check if all fields excluding quiz items match for model solution spec quiz
 * @param oldQuiz Old model solution spec quiz
 * @param modelSpecQuiz New model solution spec quiz
 * @param version Version of the model solution spec quiz
 */
const expectModelSolutionSpecMetadataToMatch = (
  oldQuiz: OldModelSolutionSpecQuiz,
  modelSolutionSpecQuiz: ModelSolutionQuiz,
  version = QUIZ_VERSION,
) => {
  expect(modelSolutionSpecQuiz.id).toEqual(oldQuiz.id)
  expect(modelSolutionSpecQuiz.title).toEqual(oldQuiz.title)
  expect(modelSolutionSpecQuiz.body).toEqual(oldQuiz.body)
  expect(modelSolutionSpecQuiz.submitMessage).toEqual(oldQuiz.submitMessage)
  expect(modelSolutionSpecQuiz.awardPointsEvenIfWrong).toEqual(oldQuiz.awardPointsEvenIfWrong)
  expect(modelSolutionSpecQuiz.grantPointsPolicy).toEqual(oldQuiz.grantPointsPolicy)
  expect(modelSolutionSpecQuiz.version).toEqual(version)
}

/**
 * Compare specified fields from new object to older object. Also check that there isn't
 * any extra fields in the new object.
 *
 * @param fields Fields from new object to older object
 * @param newObject New object, e.g. new quiz item
 * @param oldObject Old object, e.g. older quiz item
 */
const compareFields = <T extends object>(
  fields: { [key: string]: string },
  newQuizItem: T,
  oldQuizItem: QuizItem,
) => {
  Object.keys(fields).forEach((key) => {
    if (!Object.keys(newQuizItem).includes(key)) {
      throw new Error(
        `field '${key}' does not exist in the newer quiz item: ${JSON.stringify(newQuizItem)}`,
      )
    }
    if (!Object.keys(oldQuizItem).includes(fields[key])) {
      throw new Error(
        `field '${fields[key]}' does not exist in old quiz item: ${JSON.stringify(oldQuizItem)}`,
      )
    }
    expect(newQuizItem[key as keyof T]).toEqual(oldQuizItem[fields[key] as keyof QuizItem])
  })
  return false
}

/**
 * Compare all fields excluding options
 *
 * @param privateSpecQuizItem private spec quiz
 * @param oldQuizItem old quiz item
 */
const comparePrivateSpecQuizItem = (
  privateSpecQuizItem: PrivateSpecQuizItem,
  oldQuizItem: QuizItem,
) => {
  let fields = {}
  switch (privateSpecQuizItem.type) {
    case "checkbox":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "choose-n":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "closed-ended-question":
      fields = {
        id: "id",
        order: "order",
        validityRegex: "validityRegex",
        formatRegex: "formatRegex",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "essay":
      fields = {
        id: "id",
        order: "order",
        minWords: "minWords",
        maxWords: "maxWords",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "matrix":
      fields = {
        id: "id",
        order: "order",
        optionCells: "optionCells",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "multiple-choice":
      fields = {
        shuffleOptions: "shuffleOptions",
        id: "id",
        order: "order",
        allowSelectingMultipleOptions: "multi",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
        sharedOptionFeedbackMessage: "sharedOptionFeedbackMessage",
        direction: "direction",
        multipleChoiceMultipleOptionsGradingPolicy: "multipleChoiceMultipleOptionsGradingPolicy",
      }
      break
    case "multiple-choice-dropdown":
      fields = {
        id: "id",
        order: "order",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "scale":
      fields = {
        id: "id",
        order: "order",
        maxValue: "maxValue",
        minValue: "minValue",
        maxLabel: "maxLabel",
        minLabel: "minLabel",
        title: "title",
        body: "body",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
    case "timeline":
      fields = {
        id: "id",
        order: "order",
        successMessage: "successMessage",
        failureMessage: "failureMessage",
      }
      break
  }
  compareFields<PrivateSpecQuizItem>(fields, privateSpecQuizItem, oldQuizItem)
}

/**
 * Create an old quiz from list of quiz items.
 *
 * @param items Array of quiz items
 * @returns Old Quiz
 */
const createOldQuizFromQuizItems = (items: QuizItem[]) => {
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

export {
  comparePrivateSpecQuizItem,
  expectPrivateSpecMetadataToMatch,
  expectPublicSpecMetadataToMatch,
  expectModelSolutionSpecMetadataToMatch,
  generateCheckboxForOldQuiz,
  generateChooseNForOldQuiz,
  generateClosedEndedForOldQuiz,
  generateEssayForOldQuiz,
  generateMatrixForOldQuiz,
  generateMultipleChoiceForOldQuiz,
  generateScaleForOldQuiz,
  generateTimelineForOldQuiz,
  createOldQuizFromQuizItems,
}
