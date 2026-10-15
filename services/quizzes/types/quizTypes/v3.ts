/**
 * Frozen snapshot of the quiz spec types at version "3".
 *
 * Old data is stored forever in a database we cannot migrate, so the shapes an old version was
 * saved in are permanent. These types let the v1->v2 and v2->v3 migrators keep producing exactly
 * the v3 shape, and let the v3->v4 step consume it, even as the current (latest) types evolve.
 *
 * v4 remodels the feedback-message fields on the quiz, every item type and the option type, so
 * unlike the v2 snapshot almost nothing can be re-used from the current type modules: every private
 * and model-solution item type is frozen here. Types that v4 did NOT touch are still re-used from
 * the current modules: `ClosedEndedQuestionGradingStrategy` (unchanged), the public spec item types
 * and `UserItemAnswer` (public spec and answers only bumped their version literal). When a FUTURE
 * version changes one of those, snapshot its v3 shape here at that time.
 */
import type { UserItemAnswer } from "./answer"
import type {
  ClosedEndedQuestionGradingStrategy,
  DisplayDirection,
  multipleChoiceMultipleOptionsGradingPolicy,
} from "./privateSpec"
import type { PublicSpecQuizItem } from "./publicSpec"

type GrantPointsPolicy = "grant_whenever_possible" | "grant_only_when_answer_fully_correct"

// ---- option (v3) ----

export interface QuizItemOptionV3 {
  id: string
  order: number
  correct: boolean
  title: string | null
  body: string | null
  messageAfterSubmissionWhenSelected: null | string
  additionalCorrectnessExplanationOnModelSolution: null | string
}

// ---- private spec (v3) ----

export interface PrivateSpecQuizItemMultiplechoiceV3 {
  type: "multiple-choice"
  shuffleOptions: boolean
  id: string
  order: number
  allowSelectingMultipleOptions: boolean
  fogOfWar: boolean
  options: QuizItemOptionV3[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
  sharedOptionFeedbackMessage: string | null
  optionDisplayDirection: DisplayDirection
  multipleChoiceMultipleOptionsGradingPolicy: multipleChoiceMultipleOptionsGradingPolicy
}

export interface PrivateSpecQuizItemEssayV3 {
  type: "essay"
  id: string
  order: number
  minWords: number | null
  maxWords: number | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemScaleV3 {
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
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemCheckboxV3 {
  type: "checkbox"
  id: string
  order: number
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemClosedEndedQuestionV3 {
  type: "closed-ended-question"
  id: string
  order: number
  gradingStrategy: ClosedEndedQuestionGradingStrategy | null
  formatRegex: string | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemMatrixV3 {
  type: "matrix"
  id: string
  order: number
  title?: string | null
  optionCells: string[][] | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemTimelineItemV3 {
  id: string
  year: string
  correctEventName: string
  correctEventId: string
}

export interface PrivateSpecQuizItemTimelineV3 {
  type: "timeline"
  id: string
  order: number
  title?: string | null
  successMessage: string | null
  failureMessage: string | null
  timelineItems: PrivateSpecQuizItemTimelineItemV3[] | null
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemChooseNV3 {
  type: "choose-n"
  id: string
  order: number
  n: number
  options: QuizItemOptionV3[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface PrivateSpecQuizItemMultiplechoiceDropdownV3 {
  type: "multiple-choice-dropdown"
  id: string
  order: number
  options: QuizItemOptionV3[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export type PrivateSpecQuizItemV3 =
  | PrivateSpecQuizItemMultiplechoiceV3
  | PrivateSpecQuizItemEssayV3
  | PrivateSpecQuizItemScaleV3
  | PrivateSpecQuizItemCheckboxV3
  | PrivateSpecQuizItemClosedEndedQuestionV3
  | PrivateSpecQuizItemMatrixV3
  | PrivateSpecQuizItemTimelineV3
  | PrivateSpecQuizItemChooseNV3
  | PrivateSpecQuizItemMultiplechoiceDropdownV3

export interface PrivateSpecQuizV3 {
  version: "3"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: PrivateSpecQuizItemV3[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
  submitMessage: string | null
}

// ---- model solution spec (v3) ----

export interface ModelSolutionQuizItemMultiplechoiceV3 {
  type: "multiple-choice"
  shuffleOptions: boolean
  id: string
  order: number
  allowSelectingMultipleOptions: boolean
  options: QuizItemOptionV3[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
  sharedOptionFeedbackMessage: string | null
  optionDisplayDirection: DisplayDirection
  multipleChoiceMultipleOptionsGradingPolicy: multipleChoiceMultipleOptionsGradingPolicy
}

export interface ModelSolutionQuizItemEssayV3 {
  type: "essay"
  id: string
  order: number
  minWords: number | null
  maxWords: number | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface ModelSolutionQuizItemScaleV3 {
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
  messageOnModelSolution: string | null
}

export interface ModelSolutionQuizItemCheckboxV3 {
  type: "checkbox"
  id: string
  order: number
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface ModelSolutionQuizItemClosedEndedQuestionV3 {
  type: "closed-ended-question"
  id: string
  order: number
  formatRegex: string | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
  correctAnswerDisplayTexts: string[] | null
}

export interface ModelSolutionQuizItemMatrixV3 {
  type: "matrix"
  id: string
  order: number
  optionCells: string[][] | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface ModelSolutionQuizItemTimelineItemV3 {
  id: string
  year: string
  correctEventName: string
  correctEventId: string
}

export interface ModelSolutionQuizItemTimelineV3 {
  type: "timeline"
  id: string
  order: number
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
  timelineItems: ModelSolutionQuizItemTimelineItemV3[] | null
}

export interface ModelSolutionQuizItemChooseNV3 {
  type: "choose-n"
  id: string
  order: number
  n: number
  options: QuizItemOptionV3[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export interface ModelSolutionQuizItemMultiplechoiceDropdownV3 {
  type: "multiple-choice-dropdown"
  id: string
  order: number
  options: QuizItemOptionV3[]
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export type ModelSolutionQuizItemV3 =
  | ModelSolutionQuizItemMultiplechoiceV3
  | ModelSolutionQuizItemEssayV3
  | ModelSolutionQuizItemScaleV3
  | ModelSolutionQuizItemCheckboxV3
  | ModelSolutionQuizItemClosedEndedQuestionV3
  | ModelSolutionQuizItemMatrixV3
  | ModelSolutionQuizItemTimelineV3
  | ModelSolutionQuizItemChooseNV3
  | ModelSolutionQuizItemMultiplechoiceDropdownV3

export interface ModelSolutionQuizV3 {
  version: "3"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: ModelSolutionQuizItemV3[]
  title: string | null
  body: string | null
  submitMessage: string | null
}

// ---- public spec (v3) ----
// Structurally identical to v4; only the version literal is frozen at "3".

export interface PublicSpecQuizV3 {
  version: "3"
  items: PublicSpecQuizItem[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
}

// ---- user answer (v3) ----
// Structurally identical to v4; only the version literal is frozen at "3".

export interface UserAnswerV3 {
  version: "3"
  itemAnswers: UserItemAnswer[]
}
