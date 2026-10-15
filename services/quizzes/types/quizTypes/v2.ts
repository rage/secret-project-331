/**
 * Frozen snapshot of the quiz spec types at version "2".
 *
 * Old data is stored forever in a database we cannot migrate, so the shapes an old version was
 * saved in are permanent. These types let the v1->v2 migrators keep producing exactly the v2 shape,
 * and let the v2->v3 step consume it, even as the current (latest) types evolve.
 *
 * Only `closed-ended-question` changed structurally between v2 and v3, so every other item type is
 * re-used from the frozen v3 snapshot (`v3.ts`). When a FUTURE version changes another item type,
 * snapshot that type's v2 shape here at that time — do not let a re-used snapshot type drift.
 */
import type { UserItemAnswer } from "./answer"
import type { DisplayDirection } from "./privateSpec"
import type { PublicSpecQuizItem } from "./publicSpec"
import type {
  ModelSolutionQuizItemCheckboxV3,
  ModelSolutionQuizItemChooseNV3,
  ModelSolutionQuizItemEssayV3,
  ModelSolutionQuizItemMatrixV3,
  ModelSolutionQuizItemMultiplechoiceV3,
  ModelSolutionQuizItemMultiplechoiceDropdownV3,
  ModelSolutionQuizItemScaleV3,
  ModelSolutionQuizItemTimelineV3,
  PrivateSpecQuizItemCheckboxV3,
  PrivateSpecQuizItemChooseNV3,
  PrivateSpecQuizItemEssayV3,
  PrivateSpecQuizItemMatrixV3,
  PrivateSpecQuizItemMultiplechoiceV3,
  PrivateSpecQuizItemMultiplechoiceDropdownV3,
  PrivateSpecQuizItemScaleV3,
  PrivateSpecQuizItemTimelineV3,
} from "./v3"

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
  | PrivateSpecQuizItemMultiplechoiceV3
  | PrivateSpecQuizItemEssayV3
  | PrivateSpecQuizItemScaleV3
  | PrivateSpecQuizItemCheckboxV3
  | PrivateSpecQuizItemClosedEndedQuestionV2
  | PrivateSpecQuizItemMatrixV3
  | PrivateSpecQuizItemTimelineV3
  | PrivateSpecQuizItemChooseNV3
  | PrivateSpecQuizItemMultiplechoiceDropdownV3

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

// Re-uses the frozen v3 model-solution item types for everything except closed-ended, which is the
// only item that changed in v3.
export type ModelSolutionQuizItemV2 =
  | ModelSolutionQuizItemMultiplechoiceV3
  | ModelSolutionQuizItemEssayV3
  | ModelSolutionQuizItemScaleV3
  | ModelSolutionQuizItemCheckboxV3
  | ModelSolutionQuizItemClosedEndedQuestionV2
  | ModelSolutionQuizItemMatrixV3
  | ModelSolutionQuizItemTimelineV3
  | ModelSolutionQuizItemChooseNV3
  | ModelSolutionQuizItemMultiplechoiceDropdownV3

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
