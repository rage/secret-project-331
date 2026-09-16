/**
 * Frozen snapshot of the quiz spec types at version "4".
 *
 * Old data is stored forever in a database we cannot migrate, so the shapes an old version was
 * saved in are permanent. These types let the earlier migrators keep producing exactly the v4 shape
 * and let the v4->v5 step consume it, even as the current (latest) types evolve.
 *
 * v5 only adds grading fields to the matrix item, so just that item is frozen here, in the private
 * spec and the model solution spec. Every other item type, the public spec and the answer are
 * re-used from the current modules; when a FUTURE version changes one of those, snapshot its v4
 * shape here at that time.
 */
import type { UserItemAnswer } from "./answer"
import type {
  ModelSolutionQuizItemCheckbox,
  ModelSolutionQuizItemChooseN,
  ModelSolutionQuizItemClosedEndedQuestion,
  ModelSolutionQuizItemEssay,
  ModelSolutionQuizItemMultiplechoice,
  ModelSolutionQuizItemMultiplechoiceDropdown,
  ModelSolutionQuizItemScale,
  ModelSolutionQuizItemTimeline,
} from "./modelSolutionSpec"
import type {
  DisplayDirection,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemClosedEndedQuestion,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
  QuizFeedbackMessage,
} from "./privateSpec"
import type { PublicSpecQuizItem } from "./publicSpec"

type GrantPointsPolicy = "grant_whenever_possible" | "grant_only_when_answer_fully_correct"

// ---- private spec (v4) ----

export interface PrivateSpecQuizItemMatrixV4 {
  type: "matrix"
  id: string
  order: number
  title?: string | null
  optionCells: string[][] | null
  feedbackMessages: QuizFeedbackMessage[]
}

export type PrivateSpecQuizItemV4 =
  | PrivateSpecQuizItemMultiplechoice
  | PrivateSpecQuizItemEssay
  | PrivateSpecQuizItemScale
  | PrivateSpecQuizItemCheckbox
  | PrivateSpecQuizItemClosedEndedQuestion
  | PrivateSpecQuizItemMatrixV4
  | PrivateSpecQuizItemTimeline
  | PrivateSpecQuizItemChooseN
  | PrivateSpecQuizItemMultiplechoiceDropdown

export interface PrivateSpecQuizV4 {
  version: "4"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: PrivateSpecQuizItemV4[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
  feedbackMessages: QuizFeedbackMessage[]
}

// ---- model solution spec (v4) ----

export interface ModelSolutionQuizItemMatrixV4 {
  type: "matrix"
  id: string
  order: number
  optionCells: string[][] | null
  messagesOnModelSolution: string[]
}

export type ModelSolutionQuizItemV4 =
  | ModelSolutionQuizItemMultiplechoice
  | ModelSolutionQuizItemEssay
  | ModelSolutionQuizItemScale
  | ModelSolutionQuizItemCheckbox
  | ModelSolutionQuizItemClosedEndedQuestion
  | ModelSolutionQuizItemMatrixV4
  | ModelSolutionQuizItemTimeline
  | ModelSolutionQuizItemChooseN
  | ModelSolutionQuizItemMultiplechoiceDropdown

export interface ModelSolutionQuizV4 {
  version: "4"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: ModelSolutionQuizItemV4[]
  title: string | null
  body: string | null
  messagesOnModelSolution: string[]
}

// ---- public spec (v4) ----
// Structurally identical to v5; only the version literal is frozen at "4".

export interface PublicSpecQuizV4 {
  version: "4"
  items: PublicSpecQuizItem[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
}

// ---- user answer (v4) ----
// Structurally identical to v5; only the version literal is frozen at "4".

export interface UserAnswerV4 {
  version: "4"
  itemAnswers: UserItemAnswer[]
}
