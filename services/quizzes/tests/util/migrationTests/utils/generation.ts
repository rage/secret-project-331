/* eslint-disable */
import { ModelSolutionQuiz, ModelSolutionQuizItem, PublicQuiz, PublicQuizItem, PublicQuizItemOption, Quiz, QuizAnswer, QuizItem, QuizItemAnswer, QuizItemOption } from "../../../../types/types"



// Content for private quiz item

// Quiz answers
const emptyQuizAnswer = (): QuizAnswer => ({
  createdAt: '',
  updatedAt: '',
  id: '',
  itemAnswers: [],
  quizId: '',
  status: "open",
})

const emptyQuizItemAnswer = (): QuizItemAnswer => ({
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

// Private spec quiz
const emptyPrivateQuizItemOption = (): QuizItemOption => ({
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

const emptyPrivateQuizItem = (): QuizItem => ({
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

const emptyPrivateQuiz = (): Quiz => ({
  id: '',
  updatedAt: new Date(),
  createdAt: new Date(),
  courseId: '',
  part: 1,
  section: 1,
  title: '',
  body: '',
  deadline: new Date(),
  direction: "column",
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

// Public spec quiz
const emptyPublicQuiz = (): PublicQuiz => ({
  body: "",
  courseId: "",
  deadline: new Date(),
  direction: "column",
  id: "",
  items: [],
  open: new Date(),
  part: 0,
  section: 0,
  title: "",
  tries: 10,
  triesLimited: false
})

const emptyPublicQuizItem = (): PublicQuizItem => ({
  body: "",
  direction: "column",
  formatRegex: "",
  id: "",
  maxLabel: "",
  maxValue: 10,
  maxWords: 0,
  minLabel: "",
  minValue: 0,
  minWords: 0,
  multi: false,
  multipleChoiceMultipleOptionsGradingPolicy: "default",
  options: [],
  order: 0,
  quizId: "",
  shuffleOptions: false,
  timelineItemEvents: [],
  timelineItems: [],
  title: "",
  type: ""
})

const emptyPublicQuizItemOption = (): PublicQuizItemOption => ({
  body: "",
  id: "",
  order: 0,
  title: "",
  quizItemId: ""
})

// Model solution spec
const emptyModelSolutionQuiz = (): ModelSolutionQuiz => ({
  autoConfirm: false,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  body: "",
  courseId: "",
  createdAt: new Date(),
  deadline: new Date(),
  excludedFromScore: false,
  grantPointsPolicy: "grant_only_when_answer_fully_correct",
  id: "",
  items: [],
  open: new Date(),
  part: 0,
  points: 0,
  section: 0,
  submitMessage: "",
  title: "",
  tries: 0,
  triesLimited: false,
  updatedAt: new Date(),
})

const emptyModelSolutionQuizItem = (): ModelSolutionQuizItem => ({
  allAnswersCorrect: false,
  body: "",
  createdAt: new Date(),
  direction: "column",
  failureMessage: "",
  formatRegex: "",
  id:"",
  maxLabel:"",
  maxValue: 0,
  maxWords:0,
  minLabel:"",
  minValue:0,
  minWords:0,
  multi: false,
  multipleChoiceMultipleOptionsGradingPolicy:"default",
  optionCells: [],
  options:[],
  order:0,
  quizId: "",
  sharedOptionFeedbackMessage: null,
  shuffleOptions:false,
  successMessage: "",
  timelineItems:[],
  title: "",
  type: "",
  updatedAt: new Date(),
  usesSharedOptionFeedbackMessage: false
})

// Generate from templates above
// Generate private spec quiz and quiz items
export const generatePrivateQuiz = <T extends Partial<Quiz>>(initialValues: T): Quiz & T => {
  return Object.assign(emptyPrivateQuiz(), initialValues);
}

export const generatePrivateQuizItem = <T extends Partial<QuizItem>>(initialValues: T): QuizItem & T => {
  return Object.assign(emptyPrivateQuizItem(), initialValues);
}

export const generatePrivateQuizItemOption = <T extends Partial<QuizItemOption>>(initialValues: T): QuizItemOption & T => {
  return Object.assign(emptyPrivateQuizItemOption(), initialValues);
}


// Generate public spec quiz and quiz items
export const generatePublicQuiz = <T extends Partial<PublicQuiz>>(initialValues: T): PublicQuiz & T => {
  return Object.assign(emptyPublicQuiz(), initialValues);
}

export const generatePublicQuizItem = <T extends Partial<PublicQuizItem>>(initialValues: T): PublicQuizItem & T => {
  return Object.assign(emptyPublicQuizItem(), initialValues);
}

export const generatePublicQuizItemOption = <T extends Partial<PublicQuizItemOption>>(initialValues: T): PublicQuizItemOption & T => {
  return Object.assign(emptyPublicQuizItemOption(), initialValues);
}

// Generate model solution spec quiz and quiz item
export const generateModelSolutionQuiz = <T extends Partial<ModelSolutionQuiz>>(initialValues: T): ModelSolutionQuiz & T => {
  return Object.assign(emptyModelSolutionQuiz(), initialValues);
}

export const generateModelSolutionQuizItem = <T extends Partial<ModelSolutionQuizItem>>(initialValues: T): ModelSolutionQuizItem & T => {
  return Object.assign(emptyModelSolutionQuizItem(), initialValues);
}

// Quiz answer generation
export const generateQuizAnswer = <T extends Partial<QuizAnswer>>(initialValues: T): QuizAnswer & T => {
  return Object.assign(emptyQuizAnswer(), initialValues);
}

export const generateQuizItemAnswer = <T extends Partial<QuizItemAnswer>>(initialValues: T): QuizItemAnswer & T => {
  return Object.assign(emptyQuizItemAnswer(), initialValues);
}

// == Generator functions
/**
 * Generate multiple-choice quiz item for older quizzes. First items
 * in the multiple-choice are correct, rest are incorrect.
 *
 * @param correctOptions Number of correct options
 * @param numberOfOptions Number of options
 * @param order Order of the quiz item
 * @returns Private quiz item for multiple choice question
 */
const generateMultipleChoicePrivateSpecQuiz = (
  correctOptions: number,
  numberOfOptions: number,
  order: number,
): QuizItem => {
  const quizOptions: QuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: i < correctOptions,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generatePrivateQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}

const generateMultipleChoicePublicSpecQuiz = (
  correctOptions: number,
  numberOfOptions: number,
  order: number,
): PublicQuizItem => {
  const quizOptions: PublicQuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePublicQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: i < correctOptions,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generatePublicQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}

const generateMultipleChoiceModelSolutionSpecQuiz = (
  correctOptions: number,
  numberOfOptions: number,
  order: number,
): ModelSolutionQuizItem => {
  const quizOptions: QuizItemOption[] = []
  for (let i = 0; i < numberOfOptions; i++) {
    quizOptions.push(
      generatePrivateQuizItemOption({
        quizItemId: "multiple-choice-exercise",
        correct: i < correctOptions,
        title: `option-${i + 1}`,
        id: `option-${i + 1}`,
        order: i + 1,
      }),
    )
  }

  return generateModelSolutionQuizItem({
    id: "multiple-choice-exercise",
    title: "multiple-choice-quiz-item",
    type: "multiple-choice",
    multi: true,
    options: quizOptions,
    multipleChoiceMultipleOptionsGradingPolicy: "default",
    order,
  })
}


const packToPrivateSpecQuiz = (
  quizItems: QuizItem[]
) => (generatePrivateQuiz({ items: quizItems}))

const packToPublicSpecQuiz = (
  quizItems: PublicQuizItem[]
) => generatePublicQuiz({ items: quizItems })

const packToModelSolutionQuiz = (
  quizItems: QuizItem[]
) => generateModelSolutionQuiz({ items: quizItems })

const packToAnswer = (
  quizAnswers: QuizItemAnswer[]
) => generateQuizAnswer({ itemAnswers: quizAnswers })

export {
  generateMultipleChoicePrivateSpecQuiz,
  generateMultipleChoicePublicSpecQuiz,
  generateMultipleChoiceModelSolutionSpecQuiz,
  packToPrivateSpecQuiz,
  packToPublicSpecQuiz,
  packToModelSolutionQuiz,
  packToAnswer
}


