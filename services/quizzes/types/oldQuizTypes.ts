/** @deprecated */
export interface OldQuiz {
  id: string
  courseId: string
  part: number
  section: number
  points: number
  deadline: Date | null
  direction: "column" | "row" | null
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

/** @deprecated */
export interface OldNormalizedQuiz {
  id: string
  courseId: string
  part: number
  section: number
  points: number
  deadline: Date | null
  direction: "column" | "row" | null
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

/** @deprecated */
export interface OldQuizVariables {
  initialState: OldQuiz
  addingNewItem: boolean
  newItemType: string
  newItems: string[]
  deadline: Date | null
  direction: "column" | "row" | null
  validDeadline: boolean
  newQuiz: boolean
}

/** @deprecated */
export interface OldPublicQuiz {
  id: string
  courseId: string
  part: number
  section: number
  deadline: Date | null
  direction: "column" | "row" | null
  open: Date | null
  tries: number
  triesLimited: boolean
  items: OldPublicQuizItem[]
  title: string
  body: string
}

/** @deprecated */
export interface OldModelSolutionQuiz {
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
  items: OldModelSolutionQuizItem[]
  title: string
  body: string
  submitMessage: string | null
}

/** @deprecated */
export type oldMultipleChoiceMultipleOptionsGradingPolicy =
  | "default"
  | "points-off-incorrect-options"
  | "points-off-unselected-options"
  | "some-correct-none-incorrect"
/** @deprecated */
export interface QuizItem {
  shuffleOptions: boolean
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
  options: OldQuizItemOption[]
  optionCells: string[][] | null
  title: string
  body: string
  successMessage: string | null
  failureMessage: string | null
  sharedOptionFeedbackMessage: null
  allAnswersCorrect: boolean
  direction: "row" | "column"
  timelineItems: OldQuizItemTimelineItem[] | null
  multipleChoiceMultipleOptionsGradingPolicy: oldMultipleChoiceMultipleOptionsGradingPolicy
}

/** @deprecated */
export interface OldQuizItemModelSolution {
  quizItemId: string
  options?: OldOptionsFeedback[]
  successMessage?: string
  failureMessage?: string
}

/** @deprecated */
export interface OldOptionsFeedback {
  optionId: string
  successMessage?: string
  failureMessage?: string
}

/**
 * Quiz item that has been normalized.
 *
 * See this for an introduction to normalization in Redux: https://redux.js.org/tutorials/essentials/part-6-performance-normalization#normalizing-data
 */
/** @deprecated */
export interface OldNormalizedQuizItem {
  shuffleOptions: boolean
  multipleChoiceMultipleOptionsGradingPolicy: oldMultipleChoiceMultipleOptionsGradingPolicy
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
  /** Only defined for the timeline quiz item type. */
  timelineItems: string[]
}

/** @deprecated */
export interface OldQuizItemVariables {
  scaleMin: number
  scaleMax: number
  array: number[]
  advancedEditing: boolean
  advancedEditingYAxisLocation: number | undefined
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

/** @deprecated */
export interface OldPublicQuizItem {
  id: string
  quizId: string
  type: string
  order: number
  formatRegex: string | null
  multi: boolean
  shuffleOptions: boolean
  multipleChoiceMultipleOptionsGradingPolicy: oldMultipleChoiceMultipleOptionsGradingPolicy
  minWords: number | null
  maxWords: number | null
  maxValue: number | null
  minValue: number | null
  maxLabel: string | null
  minLabel: string | null
  options: OldPublicQuizItemOption[]
  timelineItems: OldPublicTimelineItem[]
  /** A list of events to choose from when matching years to events. */
  timelineItemEvents: OldPublicTimelineEvent[]
  title: string
  body: string
  direction: "row" | "column"
}

/**
 * @deprecated
 * Only used in the timeline exercise type
 *
 * The correctEvent is omitted from here because it's the correct answer and we don't want to show that to the students before they have solved the exercise. All available options can be found in `PublicQuizItem.timelineItemEvents`.
 * */
export interface OldPublicTimelineItem {
  id: string
  /** The year the student is supposed to match to an event. */
  year: string
}

/** @deprecated */
export interface OldPublicTimelineEvent {
  id: string
  name: string
}

/** @deprecated */
export type OldModelSolutionQuizItem = Omit<QuizItem, "validityRegex">

/** @deprecated */
export interface OldQuizItemOption {
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

/** @deprecated */
export interface OldNormalizedQuizItemOption {
  id: string
  quizItemId: string
  order: number
  correct: boolean
  createdAt: string
  updatedAt: string
  title: string
  body: string | null
  /**
   * Immediate feedback for user if they chose this answer. Can be used to explain why the answer
   * was right or wrong.
   *
   * Only implemented for row multiple choice at the moment.
   */
  messageAfterSubmissionWhenSelected: null | string
  /**
   * When the user has either ran out of tries or they have gotten full points from the exercise, show
   * this message on all options that don't have other feedback even if the option was not selected.
   *
   * Only implemented for row multiple choice at the moment.
   */
  additionalCorrectnessExplanationOnModelSolution: null | string
}

/** @deprecated
 *  Only defined for the timeline exercise type */
export interface OldNormalizedQuizItemTimelineItem {
  id: string
  /** The year the student is supposed to match to an event. */
  year: string
  /** The event the student is supposed choose from the dropdown menu */
  correctEventName: string
  /** Generated id for the correct event that allows us to identify the event even if the teacher has decided the edit the event name afterwards. This makes this exercise resilient to typo fixes. */
  correctEventId: string
}

/** @deprecated */
export type OldQuizItemTimelineItem = OldNormalizedQuizItemTimelineItem

/** @deprecated */
export interface OldQuizItemOptionVariables {
  optionEditing: boolean
}

/** @deprecated */
export interface OldPublicQuizItemOption {
  id: string
  quizItemId?: string
  order: number
  title: string | null
  body: string | null
}

/** @deprecated */
export interface OldQuizAnswer {
  id: string
  createdAt: string
  updatedAt: string
  quizId: string
  status: "confirmed" | "open" | "locked"
  itemAnswers: OldQuizItemAnswer[]
}

/** @deprecated */
export interface OldQuizItemAnswer {
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
  /** Only used for timeline answers. */
  timelineChoices: OldTimelineChoice[] | null
}

/** @deprecated */
export interface OldTimelineChoice {
  /** We use timelineItem id to match for answers so that this is resilient to typo fixes in the year */
  timelineItemId: string
  /** We use a generated id to match the choices to options to make this resilient to typo fixes event name. */
  chosenEventId: string
}

/** @deprecated */
export interface OldUserQuizState {
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

/** @deprecated */
export interface OldEntities {
  quizzes: { [quizId: string]: OldNormalizedQuiz }
  items: { [itemId: string]: OldNormalizedQuizItem }
  options?: { [optionId: string]: OldNormalizedQuizItemOption }
  timelineItems?: { [timelineItemId: string]: OldNormalizedQuizItemTimelineItem }
  result: string
}

/** @deprecated */
export interface OldAction {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any
}
