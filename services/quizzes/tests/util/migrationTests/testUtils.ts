/* eslint-disable i18next/no-literal-string */
import { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import { Quiz, QuizItem, QuizItemOption, QuizItemTimelineItem } from "../../../types/types"
import {
  generateQuiz,
  generateQuizItem,
  generateQuizItemOption,
} from "../../api/utils/quizGenerator"

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
  expectMetadataToMatch,
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
