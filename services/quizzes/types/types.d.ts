export interface Quiz {
  id: string
  courseId: string
  part: number
  section: number
  points: number
  deadline: Date | null
  open: Date | null
  excludedFromScore: boolean
  createdAt: Date
  updatedAt: Date
  autoConfirm: boolean
  tries: number
  triesLimited: boolean
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: "grant_whenever_possible" | "grant_only_when_answer_fully_correct"
  autoReject: boolean
  items: QuizItem[]
  title: string
  body: string
  submitMessage: string | null
}

export interface NormalizedQuiz {
  id: string
  courseId: string
  part: number
  section: number
  points: number
  deadline: Date | null
  open: Date | null
  excludedFromScore: boolean
  createdAt: string
  updatedAt: string
  autoConfirm: boolean
  tries: number
  triesLimited: boolean
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: string
  autoReject: boolean
  items: string[]
  course: string
  title: string
  body: string
  submitMessage: string | null
}

export interface QuizVariables {
  initialState: Quiz
  addingNewItem: boolean
  newItemType: string
  newItems: string[]
  deadline: Date | null
  validDeadline: boolean
  newQuiz: boolean
}

export interface PublicQuiz {
  id: string
  courseId: string
  part: number
  section: number
  deadline: Date | null
  open: Date | null
  tries: number
  triesLimited: boolean
  items: PublicQuizItem[]
  title: string
  body: string
}

export interface ModelSolutionQuiz {
  id: string
  courseId: string
  part: number
  section: number
  points: number
  deadline: Date | null
  open: Date | null
  excludedFromScore: boolean
  createdAt: Date
  updatedAt: Date
  autoConfirm: boolean
  tries: number
  triesLimited: boolean
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: "grant_whenever_possible" | "grant_only_when_answer_fully_correct"
  autoReject: boolean
  items: ModelSolutionQuizItem[]
  title: string
  body: string
  submitMessage: string | null
}

export interface QuizItem {
  id: string
  quizId: string
  type: string
  order: number
  validityRegex: string | null
  formatRegex: string | null
  multi: boolean
  createdAt: Date
  updatedAt: Date
  minWords: number | null
  maxWords: number | null
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  usesSharedOptionFeedbackMessage: boolean
  options: QuizItemOption[]
  optionCells: string[][] | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
  sharedOptionFeedbackMessage: null
  allAnswersCorrect: boolean
  direction: "row" | "column"
  feedbackDisplayPolicy: "DisplayFeedbackOnQuizItem" | "DisplayFeedbackOnAllOptions"
}

export interface QuizItemModelSolution {
  quizItemId: string
  options?: OptionsFeedback[]
  successMessage?: string
  failureMessage?: string
}

export interface OptionsFeedback {
  optionId: string
  successMessage?: string
  failureMessage?: string
}

export interface NormalizedQuizItem {
  id: string
  quizId: string
  type: string
  order: number
  validityRegex: string | null
  formatRegex: string | null
  multi: boolean
  createdAt: string
  updatedAt: string
  minWords: number | null
  maxWords: number | null
  maxValue: number | null
  minValue: number | null
  usesSharedOptionFeedbackMessage: boolean
  options: string[]
  optionCells: string[][] | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
  sharedOptionFeedbackMessage: string | null
  allAnswersCorrect: boolean
  direction: "row" | "column"
  feedbackDisplayPolicy: "DisplayFeedbackOnQuizItem" | "DisplayFeedbackOnAllOptions"
}

export interface QuizItemVariables {
  scaleMin: number
  scaleMax: number
  validMin: boolean
  validMax: boolean
  array: number[]
  advancedEditing: boolean
  testingRegex: boolean
  testingFormatRegex: boolean
  validityRegexTestAnswer: string
  formatRegexTestAnswer: string
  regex: string
  formatRegex: string
  validRegex: boolean
  validFormatRegex: boolean
  newOptions: string[]
}

export interface PublicQuizItem {
  id: string
  quizId: string
  type: string
  order: number
  formatRegex: string | null
  multi: boolean
  minWords: number | null
  maxWords: number | null
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  options: PublicQuizItemOption[]
  title: string
  body: string
  direction: "row" | "column"
}

export type ModelSolutionQuizItem = Omit<QuizItem, "validityRegex">

export interface QuizItemOption {
  id: string
  quizItemId?: string
  order: number
  correct: boolean
  createdAt: Date
  updatedAt: Date
  title: string
  body: string | null
  successMessage: null | string
  failureMessage: null | string
}

export interface NormalizedQuizItemOption {
  id: string
  quizItemId: string
  order: number
  correct: boolean
  createdAt: string
  updatedAt: string
  title: string
  body: string | null
  successMessage: null | string
  failureMessage: null | string
}

export interface QuizItemOptionVariables {
  optionEditing: boolean
}

export interface PublicQuizItemOption {
  id: string
  quizItemId?: string
  order: number
  title: string | null
  body: string | null
}

export interface QuizAnswer {
  id: string
  createdAt: string
  updatedAt: string
  quizId: string
  status: "confirmed" | "open" | "locked"
  itemAnswers: QuizItemAnswer[]
}

export interface QuizItemAnswer {
  id: string
  quizAnswerId: string
  quizItemId: string
  textData: string | null
  intData: number | null
  createdAt: string
  updatedAt: string
  correct: boolean
  /** Whether or not the provided answer can be submitted. */
  valid: boolean
  /** Only contains an id of a selected option */
  optionAnswers: string[] | null
  optionCells: string[][] | null
}

export interface UserQuizState {
  userId: number
  quizId: string
  peerReviewsGiven: number
  peerReviewsReceived: number | null
  pointsAwarded: number
  spamFlags: number | null
  tries: number
  status: string
  createdAt: string
  updatedAt: string
}

export interface Entities {
  quizzes: { [quizId: string]: NormalizedQuiz }
  items: { [itemId: string]: NormalizedQuizItem }
  options?: { [optionId: string]: NormalizedQuizItemOption }
  result: string
}

export interface action {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any
}
