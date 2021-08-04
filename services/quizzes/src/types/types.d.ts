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
  grantPointsPolicy: string
  autoReject: boolean
  items: Item[]
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
  deadline: string | null
  open: string | null
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
  deadline: string
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
  items: PublicItem[]
  title: string
  body: string
}

export interface Item {
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
  options: Option[]
  title: string
  body: string
  successMessage: null
  failureMessage: null
  sharedOptionFeedbackMessage: null
  allAnswersCorrect: boolean
  direction: "row" | "column"
  feedbackDisplayPolicy: "DisplayFeedbackOnQuizItem" | "DisplayFeedbackOnAllOptions"
}

export interface NormalizedItem {
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
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
  sharedOptionFeedbackMessage: string | null
  allAnswersCorrect: boolean
  direction: "row" | "column"
  feedbackDisplayPolicy: "DisplayFeedbackOnQuizItem" | "DisplayFeedbackOnAllOptions"
}

export interface ItemVariables {
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

export interface PublicItem {
  id: string
  quizId: string
  type: string
  order: number
  multi: boolean
  minWords: number | null
  maxWords: number | null
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  options: PublicOption[]
  title: string
  body: string
  direction: "row" | "column"
}

export interface Option {
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

export interface NormalizedOption {
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

export interface OptionVariables {
  optionEditing: boolean
}

export interface PublicOption {
  id: string
  quizItemId?: string
  order: number
  title: string
  body: string | null
}

export interface Answer {
  id: string
  quizId: string
  userId: number
  languageId: string
  status: string
  createdAt: string
  updatedAt: string
  userQuizState: UserQuizState
  itemAnswers: ItemAnswer[]
  peerReviews: PeerReview[]
  quiz: Quiz
  deleted: boolean
}

export interface ItemAnswer {
  id: string
  quizAnswerId: string
  quizItemId: string
  textData: string
  intData: null
  correct: boolean
  createdAt: string
  updatedAt: string
  optionAnswers: OptionAnswer[]
}

export interface OptionAnswer {
  id: string
  quizItemAnswerId: string
  quizOptionId: string
  createdAt: string
  updatedAt: string
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
  items: { [itemId: string]: NormalizedItem }
  options?: { [optionId: string]: NormalizedOption }
  result: string
}

export interface action {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any
}
