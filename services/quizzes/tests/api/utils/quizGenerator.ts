/* eslint-disable */
import { NonGenericGradingRequest } from "../../../src/shared-module/exercise-service-protocol-types";
import { COLUMN } from "../../../src/util/constants";
import { oldMultipleChoiceMultipleOptionsGradingPolicy, OldQuiz, OldQuizAnswer, QuizItem, OldQuizItemAnswer, OldQuizItemOption } from "../../../types/oldQuizTypes";


const emptyQuizAnswer = (): OldQuizAnswer => ({
  createdAt: '',
  updatedAt: '',
  id: '',
  itemAnswers: [],
  quizId: '',
  status: "open",
})
const emptyQuizItemAnswer = (): OldQuizItemAnswer => ({
  id: "v4()",
  quizAnswerId: "v4()",
  quizItemId: "v4()",
  textData: null,
  intData: null,
  createdAt: "",
  updatedAt: "",
  correct: false,
  /** Whether or not the provided answer can be submitted. */
  valid: true,
  /** Only contains an id of a selected option */
  optionAnswers: null,
  optionCells: null,
  /** Only used for timeline answers. */
  timelineChoices: null
})

const emptyQuizItemOption = (): OldQuizItemOption => ({
  id: 'v4()',
  title: '',
  body: '',
  order: 0,
  quizItemId: 'v4()',
  createdAt: new Date(),
  updatedAt: new Date(),
  correct: false,
  messageAfterSubmissionWhenSelected: '',
  additionalCorrectnessExplanationOnModelSolution: '',
})

const emptyQuizItem = (): QuizItem => ({
  validityRegex: '',
  id: 'v4()',
  allAnswersCorrect: false,
  body: '',
  createdAt: new Date(),
  direction: 'column',
  failureMessage: '',
  formatRegex: '',
  maxLabel: '',
  minLabel: '',
  maxWords: 0,
  minValue: 0,
  maxValue: 0,
  minWords: 0,
  multi: false,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  optionCells: [],
  options: [],
  order: 0,
  quizId: 'v4()',
  sharedOptionFeedbackMessage: null,
  shuffleOptions: false,
  successMessage: '',
  timelineItems: [],
  title: '',
  type: '',
  updatedAt: new Date(),
  usesSharedOptionFeedbackMessage: false
})

const emptyQuiz = (): OldQuiz => ({
  id: '',
  updatedAt: new Date(),
  createdAt: new Date(),
  courseId: '',
  part: 1,
  section: 1,
  title: '',
  body: '',
  deadline: new Date(),
  direction: COLUMN,
  open: new Date(),
  items: [],
  tries: 10,
  triesLimited: false,
  autoConfirm: false,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  excludedFromScore: false,
  grantPointsPolicy: "grant_only_when_answer_fully_correct",
  points: 0,
  submitMessage: '',
})

export const generateQuiz = <T extends Partial<OldQuiz>>(initialValues: T): OldQuiz & T => {
  return Object.assign(emptyQuiz(), initialValues);
}

export const generateQuizItem = <T extends Partial<QuizItem>>(initialValues: T): QuizItem & T => {
  return Object.assign(emptyQuizItem(), initialValues);
}

export const generateQuizItemOption = <T extends Partial<OldQuizItemOption>>(initialValues: T): OldQuizItemOption & T => {
  return Object.assign(emptyQuizItemOption(), initialValues);
}

export const generateQuizAnswer = <T extends Partial<OldQuizAnswer>>(initialValues: T): OldQuizAnswer & T => {
  return Object.assign(emptyQuizAnswer(), initialValues);
}

export const generateQuizItemAnswer = <T extends Partial<OldQuizItemAnswer>>(initialValues: T): OldQuizItemAnswer & T => {
  return Object.assign(emptyQuizItemAnswer(), initialValues);
}

/**
 * Generates quiz with multiple-choice exercise. First few options are correct and all the rest are incorrect.
 * Each item has an id of 'option-<order-number>'
 *
 * @param numberOfOptions Number of correct options
 * @param numberOfCorrectOptions Number of correct options
 * @param options List of options. E.g. ['option-1', 'option-3']
 * @param multi If set to false, only a single option can be selected. true by default.
 * @returns Quiz with multiple-choice exercise
 */
export const generateMultipleChoiceRequest = (
    numberOfOptions: number,
    numberOfCorrectOptions: number,
    options: string[],
    multipleChoiceMultipleOptionsGradingPolicy: oldMultipleChoiceMultipleOptionsGradingPolicy,
    multi=true
): NonGenericGradingRequest => {
  // Create quiz with multiple choice
  const quizItemId = 'multiple-choice-test-id'

  let quizOptions: OldQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(generateQuizItemOption({
      quizItemId,
      correct: i < numberOfCorrectOptions,
      title: `option-${i + 1}`,
      id: `option-${i + 1}`,
      order: i + 1
    }))
  }

  const multipleChoice = generateQuizItem({
    id: quizItemId,
    type: 'multiple-choice',
    multi,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy
  })

  const publicQuiz = generateQuiz({
    title: 'Generated Multiple Choice',
    items: [multipleChoice]
  })

  // Create quiz answer
  const quizItemAnswer = generateQuizItemAnswer({
    quizItemId,
    optionAnswers: options
  })

  const quizAnswer = generateQuizAnswer({
    itemAnswers: [quizItemAnswer]
  })

  return {
    grading_update_url: "example",
    exercise_spec: publicQuiz,
    submission_data: quizAnswer
  }
}
