/**
 * Frozen snapshot of the quiz spec types at version "2".
 *
 * Old data is stored forever in a database we cannot migrate, so the shapes an old version was
 * saved in are permanent. These types let the v1->v2 migrators keep producing exactly the v2 shape,
 * and let the v2->v3 step consume it, even as the current (latest) types evolve.
 *
 * Only `closed-ended-question` changed structurally between v2 and v3, so every other item type is
 * re-used from the current type modules. When a FUTURE version changes another item type, snapshot
 * that type's v2 shape here at that time — do not let a re-used current type drift.
 */
import type { UserItemAnswer } from "./answer"
import type {
  ModelSolutionQuizItemCheckbox,
  ModelSolutionQuizItemChooseN,
  ModelSolutionQuizItemEssay,
  ModelSolutionQuizItemMatrix,
  ModelSolutionQuizItemMultiplechoice,
  ModelSolutionQuizItemMultiplechoiceDropdown,
  ModelSolutionQuizItemScale,
  ModelSolutionQuizItemTimeline,
} from "./modelSolutionSpec"
import type {
  DisplayDirection,
  PrivateSpecQuizItemCheckbox,
  PrivateSpecQuizItemChooseN,
  PrivateSpecQuizItemEssay,
  PrivateSpecQuizItemMatrix,
  PrivateSpecQuizItemMultiplechoice,
  PrivateSpecQuizItemMultiplechoiceDropdown,
  PrivateSpecQuizItemScale,
  PrivateSpecQuizItemTimeline,
} from "./privateSpec"
import type { PublicSpecQuizItem } from "./publicSpec"

type GrantPointsPolicy = "grant_whenever_possible" | "grant_only_when_answer_fully_correct"

// ---- private spec (v2) ----

export interface PrivateSpecQuizItemClosedEndedQuestionV2 {
  type: "closed-ended-question"
  id: string
  order: number
  validityRegex: string | null
  formatRegex: string | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

export type PrivateSpecQuizItemV2 =
  | PrivateSpecQuizItemMultiplechoice
  | PrivateSpecQuizItemEssay
  | PrivateSpecQuizItemScale
  | PrivateSpecQuizItemCheckbox
  | PrivateSpecQuizItemClosedEndedQuestionV2
  | PrivateSpecQuizItemMatrix
  | PrivateSpecQuizItemTimeline
  | PrivateSpecQuizItemChooseN
  | PrivateSpecQuizItemMultiplechoiceDropdown

export interface PrivateSpecQuizV2 {
  version: "2"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: PrivateSpecQuizItemV2[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
  submitMessage: string | null
}

// ---- model solution spec (v2) ----

export interface ModelSolutionQuizItemClosedEndedQuestionV2 {
  type: "closed-ended-question"
  id: string
  order: number
  formatRegex: string | null
  title: string | null
  body: string | null
  successMessage: string | null
  failureMessage: string | null
  messageOnModelSolution: string | null
}

// Re-uses the current model-solution item types for everything except closed-ended, which is the
// only item that changed in v3.
export type ModelSolutionQuizItemV2 =
  | ModelSolutionQuizItemMultiplechoice
  | ModelSolutionQuizItemEssay
  | ModelSolutionQuizItemScale
  | ModelSolutionQuizItemCheckbox
  | ModelSolutionQuizItemClosedEndedQuestionV2
  | ModelSolutionQuizItemMatrix
  | ModelSolutionQuizItemTimeline
  | ModelSolutionQuizItemChooseN
  | ModelSolutionQuizItemMultiplechoiceDropdown

export interface ModelSolutionQuizV2 {
  version: "2"
  awardPointsEvenIfWrong: boolean
  grantPointsPolicy: GrantPointsPolicy
  items: ModelSolutionQuizItemV2[]
  title: string | null
  body: string | null
  submitMessage: string | null
}

// ---- public spec (v2) ----
// Structurally identical to v3; only the version literal is frozen at "2".

export interface PublicSpecQuizV2 {
  version: "2"
  items: PublicSpecQuizItem[]
  title: string | null
  body: string | null
  quizItemDisplayDirection: DisplayDirection
}

// ---- user answer (v2) ----
// Structurally identical to v3; only the version literal is frozen at "2".

export interface UserAnswerV2 {
  version: "2"
  itemAnswers: UserItemAnswer[]
}
