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
  version: "3"
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

/**
 * How a closed-ended answer is judged correct. This is a discriminated union on `strategy` so the
 * teacher's chosen grading method is persisted in the spec (it used to live only in the editor's
 * local React state and was lost on reopen) and each method carries exactly the fields it needs.
 */
export type ClosedEndedQuestionGradingStrategy =
  | ClosedEndedGradingStrategyExactMatch
  | ClosedEndedGradingStrategyRegex
  | ClosedEndedGradingStrategyNumeric

export interface ClosedEndedGradingStrategyExactMatch {
  strategy: "exact-match"
  /**
   * Literal accepted answers, compared as plain strings (never as regexes) so answers like `C++`,
   * `3.14` or `(x)` are matched literally. All entries are safe to reveal in the model solution.
   */
  acceptedAnswers: string[]
  caseSensitive: boolean
  /** Trim ends and collapse internal whitespace runs to a single space before comparing. */
  trimWhitespace: boolean
}

export interface ClosedEndedGradingStrategyRegex {
  strategy: "regex"
  pattern: string
  caseSensitive: boolean
  /** When true the pattern is anchored as `^(?:pattern)$`. */
  matchWholeAnswer: boolean
  /**
   * A human-readable representative correct answer shown in the model solution. The pattern itself
   * is never revealed, because it is the acceptance rule and may accept more than one answer.
   */
  exampleCorrectAnswer: string | null
}

export interface ClosedEndedGradingStrategyNumeric {
  strategy: "numeric"
  correctValue: number
  /** Absolute tolerance; 0 means the value must match exactly. */
  tolerance: number
  /** Accept e.g. `3,14` as `3.14` (common outside English locales). */
  acceptCommaAsDecimalSeparator: boolean
}

export interface PrivateSpecQuizItemClosedEndedQuestion {
  type: "closed-ended-question"
  id: string
  order: number
  /** null while the teacher has not chosen a strategy yet (a draft; parseable but not valid to publish). */
  gradingStrategy: ClosedEndedQuestionGradingStrategy | null
  /** Input-format validation only (client-side UX). Public-safe and strictly separate from correctness. */
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
  title?: string | null
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
  title?: string | null
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
