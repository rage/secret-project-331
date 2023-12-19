type GrantPointsPolicy = "grant_whenever_possible" | "grant_only_when_answer_fully_correct"

export interface QuizItemOption {
  id: string
  order: number
  correct: boolean
  title: string | null
  body: string | null
  messageAfterSubmissionWhenSelected: null | string
  additionalCorrectnessExplanationOnModelSolution: null | string
}

export type DisplayDirection = "horizontal" | "vertical"
export interface PrivateSpecQuiz {
  version: "2"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: PrivateSpecQuizItem[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
  submitMessage: string | null
}

export type QuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "closed-ended-question"
  | "matrix"
  | "timeline"
  | "choose-n"
  | "multiple-choice-dropdown"

export type multipleChoiceMultipleOptionsGradingPolicy =
  | "default"
  | "points-off-incorrect-options"
  | "points-off-unselected-options"
  | "some-correct-none-incorrect"

export type PrivateSpecQuizItem =
  | PrivateSpecQuizItemMultiplechoice
  | PrivateSpecQuizItemEssay
  | PrivateSpecQuizItemScale
  | PrivateSpecQuizItemCheckbox
  | PrivateSpecQuizItemClosedEndedQuestion
  | PrivateSpecQuizItemMatrix
  | PrivateSpecQuizItemTimeline
  | PrivateSpecQuizItemChooseN
  | PrivateSpecQuizItemMultiplechoiceDropdown

export interface PrivateSpecQuizItemMultiplechoice {
  type: "multiple-choice"
  shuffleOptions: boolean
  id: string
  order: number
  allowSelectingMultipleOptions: boolean
  fogOfWar: boolean
  options: QuizItemOption[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
  sharedOptionFeedbackMessage: string | null
  optionDisplayDirection: DisplayDirection
  multipleChoiceMultipleOptionsGradingPolicy: multipleChoiceMultipleOptionsGradingPolicy
}

export interface PrivateSpecQuizItemEssay {
  type: "essay"
  id: string
  order: number
  minWords: number | null
  maxWords: number | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemScale {
  type: "scale"
  id: string
  order: number
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemCheckbox {
  type: "checkbox"
  id: string
  order: number
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemClosedEndedQuestion {
  type: "closed-ended-question"
  id: string
  order: number
  validityRegex: string | null
  formatRegex: string | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemMatrix {
  type: "matrix"
  id: string
  order: number
  optionCells: string[][] | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemTimelineItem {
  id: string
  /** The year the student is supposed to match to an event. */
  year: string
  /** The event the student is supposed choose from the dropdown menu */
  correctEventName: string
  /** Generated id for the correct event that allows us to identify the event even if the teacher has decided the edit the event name afterwards. This makes this exercise resilient to typo fixes. */
  correctEventId: string
}

export interface PrivateSpecQuizItemTimeline {
  type: "timeline"
  id: string
  order: number
  successMessage: string | null
  failureMessage: string | null
  timelineItems: PrivateSpecQuizItemTimelineItem[] | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemChooseN {
  type: "choose-n"
  id: string
  order: number
  n: number
  options: QuizItemOption[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemMultiplechoiceDropdown {
  type: "multiple-choice-dropdown"
  id: string
  order: number
  options: QuizItemOption[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  /** Message to show either when the user has gotten full points or has ran out of tries. */
  messageOnModelSolution: string | null
}
