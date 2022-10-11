type grantPointsPolicy = "grant_whenever_possible" | "grant_only_when_answer_fully_correct"


export interface QuizItemOption {
  id: string
  quizItemId?: string
  order: number
  correct: boolean
  createdAt: Date
  updatedAt: Date
  title: string
  body: string | null
  messageAfterSubmissionWhenSelected: null | string
  additionalCorrectnessExplanationOnModelSolution: null | string
}

export interface PrivateSpecQuiz {
  version: "2"
  id: string
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: grantPointsPolicy
  items: QuizItem[]
  title: string
  body: string
  submitMessage: string | null
}

type QuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "closed-ended-question"
  | "matrix"
  | "timeline"
  | "choose-n"

type OldQuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "open"
  | "matrix"
  | "timeline"
  | "clickable-multiple-choice"

type multipleChoiceMultipleOptionsGradingPolicy =
  | "default"
  | "points-off-incorrect-options"
  | "points-off-unselected-options"

export type PrivateSpecQuizItem =
  | PrivateSpecQuizItemMultiplechoice
  | PrivateSpecQuizItemEssay
  | PrivateSpecQuizItemScale
  | PrivateSpecQuizItemCheckbox
  | PrivateSpecQuizItemClosedEndedQuestion
  | PrivateSpecQuizItemMatrix
  | PrivateSpecQuizItemTimeline
  | PrivateSpecQuizItemChooseN

export interface PrivateSpecQuizItemMultiplechoice {
  type: "multiple-choice"
  shuffleOptions: boolean
  id: string
  order: number
  allowSelectingMultipleOptions: boolean
  options: QuizItemOption[]
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
  sharedOptionFeedbackMessage: null
  direction: "row" | "column"
  multipleChoiceMultipleOptionsGradingPolicy: multipleChoiceMultipleOptionsGradingPolicy
}

export interface PrivateSpecQuizItemEssay {
  type: "essay"
  id: string
  order: number
  minWords: number | null
  maxWords: number | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface PrivateSpecQuizItemScale {
  type: "scale"
  id: string
  order: number
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface PrivateSpecQuizItemCheckbox {
  type: "checkbox"
  id: string
  order: number
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface PrivateSpecQuizItemClosedEndedQuestion {
  type: "closed-ended-question"
  id: string
  order: number
  validityRegex: string | null
  formatRegex: string | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface PrivateSpecQuizItemMatrix {
  type: "matrix"
  id: string
  order: number
  optionCells: string[][] | null
  successMessage: string | null
  failureMessage: string | null
}

export interface PrivateSpecQuizItemTimeline {
  type: "timeline"
  id: string
  order: number
  successMessage: string | null
  failureMessage: string | null
  timelineItems: QuizItemTimelineItem[] | null
}

export interface PrivateSpecQuizItemChooseN {
  type: "choose-n"
  id: string
  order: number
  options: QuizItemOption[]
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}
