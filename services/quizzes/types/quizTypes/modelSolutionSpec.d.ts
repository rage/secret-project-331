type grantPointsPolicy = "grant_whenever_possible" | "grant_only_when_answer_fully_correct"

export interface QuizItemOption {
  id: string
  order: number
  correct: boolean
  title: string
  body: string | null
  messageAfterSubmissionWhenSelected: null | string
  additionalCorrectnessExplanationOnModelSolution: null | string
}

export interface ModelSolutionQuiz {
  version: "2"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: grantPointsPolicy
  items: ModelSolutionQuizItem[]
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
  | "multiple-choice-dropdown"

type OldQuizItemType =
  | "essay"
  | "multiple-choice"
  | "scale"
  | "checkbox"
  | "open"
  | "matrix"
  | "timeline"
  | "clickable-multiple-choice"
  | "multiple-choice-dropdown"

type multipleChoiceMultipleOptionsGradingPolicy =
  | "default"
  | "points-off-incorrect-options"
  | "points-off-unselected-options"

export type ModelSolutionQuizItem =
  | ModelSolutionQuizItemMultiplechoice
  | ModelSolutionQuizItemEssay
  | ModelSolutionQuizItemScale
  | ModelSolutionQuizItemCheckbox
  | ModelSolutionQuizItemClosedEndedQuestion
  | ModelSolutionQuizItemMatrix
  | ModelSolutionQuizItemTimeline
  | ModelSolutionQuizItemChooseN
  | ModelSolutionQuizItemMultiplechoiceDropdown

export interface ModelSolutionQuizItemMultiplechoice {
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
  sharedOptionFeedbackMessage: string | null
  direction: "row" | "column"
  multipleChoiceMultipleOptionsGradingPolicy: multipleChoiceMultipleOptionsGradingPolicy
}

export interface ModelSolutionQuizItemEssay {
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

export interface ModelSolutionQuizItemScale {
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

export interface ModelSolutionQuizItemCheckbox {
  type: "checkbox"
  id: string
  order: number
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface ModelSolutionQuizItemClosedEndedQuestion {
  type: "closed-ended-question"
  id: string
  order: number
  formatRegex: string | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface ModelSolutionQuizItemMatrix {
  type: "matrix"
  id: string
  order: number
  optionCells: string[][] | null
  successMessage: string | null
  failureMessage: string | null
}

export interface ModelSolutionQuizItemTimelineItem {
  id: string
  /** The year the student is supposed to match to an event. */
  year: string
  /** The event the student is supposed choose from the dropdown menu */
  correctEventName: string
  /** Generated id for the correct event that allows us to identify the event even if the teacher has decided the edit the event name afterwards. This makes this exercise resilient to typo fixes. */
  correctEventId: string
}

export interface ModelSolutionQuizItemTimeline {
  type: "timeline"
  id: string
  order: number
  successMessage: string | null
  failureMessage: string | null
  timelineItems: ModelSolutionQuizItemTimelineItem[] | null
}

export interface ModelSolutionQuizItemChooseN {
  type: "choose-n"
  id: string
  order: number
  n: number
  options: QuizItemOption[]
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}

export interface ModelSolutionQuizItemMultiplechoiceDropdown {
  type: "multiple-choice-dropdown"
  id: string
  order: number
  options: QuizItemOption[]
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
}
