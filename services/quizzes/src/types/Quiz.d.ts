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
  peerReviewCollections: PeerReviewCollection[]
  title: string
  body: string
  submitMessage: string | null
}

export interface Item {
  id: string
  quizId: string
  type: string
  order: number
  validityRegex: null
  formatRegex: null
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
  title: null
  body: null
  successMessage: null
  failureMessage: null
  sharedOptionFeedbackMessage: null
  allAnswersCorrect: boolean
  direction: "row" | "column"
  feedbackDisplayPolicy: "DisplayFeedbackOnQuizItem" | "DisplayFeedbackOnAllOptions"
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

export interface PeerReviewCollection {
  id: string
  quizId: string
  createdAt: Date
  updatedAt: Date
  questions: Question[]
  title: string
  body: string
}

export interface Question {
  id: string
  quizId: string
  peerReviewCollectionId?: string
  default: boolean
  type: string
  answerRequired: boolean
  order: number
  createdAt: string
  updatedAt: string
  title: string
  body: string
}

export interface Course {
  id: string
  minScoreToPass: null
  minProgressToPass: null
  minPeerReviewsReceived: null
  minPeerReviewsGiven: null
  minReviewAverage: null
  maxSpamFlags: null
  createdAt: Date
  updatedAt: Date
  organizationId: null
  moocfiId: null
  maxReviewSpamFlags: number
  languageId: string
  title: string
  body: string
  abbreviation: string
  status: string
}

export interface PeerReviewQuestion {
  id: string
  quizId: string
  peerReviewCollectionId: string
  default: boolean
  type: string
  answerRequired: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  peerReviewQuestionId: string
  languageId: string
  title: string
  body: string
}

export interface Language {
  country: string
  createdAt: Date
  id: string
  name: string
  updatedAt: Date
}

export interface DownloadFormProps {
  quizId: string
  quizName: string
  course: Course
}
export type TEditorQuiz = Optional<Quiz, "id">
export type TEditorPeerReviewCollection = Optional<PeerReviewCollection, "id">
export type TEditorOption = Optional<Option, "id">
export type TEditorItem = Optional<Item, "id">
export type TEditorQuestion = Optional<Question, "id">
