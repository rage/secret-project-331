import type {
  OldModelSolutionQuiz,
  OldPublicQuiz,
  OldQuizAnswer,
} from "../../../types/oldQuizTypes"
/**
 * The one place old quiz blobs are lifted to the current version.
 *
 * The host stores our specs and answers as opaque blobs it cannot migrate, so old shapes keep
 * arriving at our endpoints and views forever. Every entry door (public-spec endpoint,
 * model-solution endpoint, grade path, and the editor/answer/submission iframe) calls exactly one
 * of the `migrate*ToLatest` functions below and never sees version logic itself.
 *
 * ── How to add a new version (e.g. v4) ─────────────────────────────────────────────────────────
 *   1. Bump `LATEST_QUIZ_VERSION` to "4" in `versions.ts` and add "4" to `QuizSpecVersion`.
 *   2. Snapshot any item type you are about to change into `types/quizTypes/v2.ts`'s sibling (a
 *      `v3.ts`) so the v2->v3 step keeps compiling against the shape it produces.
 *   3. Write `migrate*V3ToV4` step functions (mirroring `v2ToV3.ts`).
 *   4. Add one line per registry below: `"3": (b) => migrateXxxV3ToV4(b as XxxV3)`.
 * No door changes are ever needed. That is the whole point of this module.
 */
import type { UserAnswer } from "../../../types/quizTypes/answer"
import type { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import type { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import type { PublicSpecQuiz } from "../../../types/quizTypes/publicSpec"
import type {
  ModelSolutionQuizV2,
  PrivateSpecQuizV2,
  PublicSpecQuizV2,
  UserAnswerV2,
} from "../../../types/quizTypes/v2"
import type {
  ModelSolutionQuizV3,
  PrivateSpecQuizV3,
  PublicSpecQuizV3,
  UserAnswerV3,
} from "../../../types/quizTypes/v3"
import { migrateQuiz } from "../migrate"
import migrateModelSolutionSpecQuiz from "./modelSolutionSpecQuiz"
import { migratePrivateSpecQuiz } from "./privateSpecQuiz"
import migratePublicSpecQuiz from "./publicSpecQuiz"
import migrateQuizAnswer from "./userAnswerSpec"
import {
  migrateModelSolutionV2ToV3,
  migratePrivateSpecV2ToV3,
  migratePublicSpecV2ToV3,
  migrateUserAnswerV2ToV3,
} from "./v2ToV3"
import {
  migrateModelSolutionV3ToV4,
  migratePrivateSpecV3ToV4,
  migratePublicSpecV3ToV4,
  migrateUserAnswerV3ToV4,
} from "./v3ToV4"
import { detectQuizVersion, LATEST_QUIZ_VERSION, type QuizSpecVersion } from "./versions"

/** A step migrates a spec blob up exactly one version. Keyed by the version it accepts. */
type SpecMigrationStep = (blob: unknown) => unknown
type SpecMigrationSteps = Partial<Record<QuizSpecVersion, SpecMigrationStep>>

const runSpecChain = (blob: unknown, steps: SpecMigrationSteps, kind: string): unknown => {
  let current = blob
  let version = detectQuizVersion(current)
  const visited = new Set<QuizSpecVersion>()
  while (version !== LATEST_QUIZ_VERSION) {
    visited.add(version)
    const step = steps[version]
    if (!step) {
      throw new Error(`No ${kind} migration step from version '${version}'`)
    }
    current = step(current)
    const next = detectQuizVersion(current)
    // A step that stalls or downgrades would loop forever; fail loud instead.
    if (visited.has(next)) {
      throw new Error(
        `${kind} migration step from version '${version}' did not advance the version (emitted '${next}')`,
      )
    }
    version = next
  }
  return current
}

// The v1->v2 private-spec step also runs the legacy option-feedback fixup (`migrate.ts`). It used
// to run only in the editor iframe; folding it in here means every path gets it.
const privateSpecSteps: SpecMigrationSteps = {
  "1": (blob) => migratePrivateSpecQuiz(migrateQuiz(blob)),
  "2": (blob) => migratePrivateSpecV2ToV3(blob as PrivateSpecQuizV2),
  "3": (blob) => migratePrivateSpecV3ToV4(blob as PrivateSpecQuizV3),
}

const publicSpecSteps: SpecMigrationSteps = {
  "1": (blob) => migratePublicSpecQuiz(blob as OldPublicQuiz),
  "2": (blob) => migratePublicSpecV2ToV3(blob as PublicSpecQuizV2),
  "3": (blob) => migratePublicSpecV3ToV4(blob as PublicSpecQuizV3),
}

const modelSolutionSteps: SpecMigrationSteps = {
  "1": (blob) => migrateModelSolutionSpecQuiz(blob as OldModelSolutionQuiz),
  "2": (blob) => migrateModelSolutionV2ToV3(blob as ModelSolutionQuizV2),
  "3": (blob) => migrateModelSolutionV3ToV4(blob as ModelSolutionQuizV3),
}

export const migratePrivateSpecToLatest = (blob: unknown): PrivateSpecQuiz =>
  runSpecChain(blob, privateSpecSteps, "private spec") as PrivateSpecQuiz

export const migratePublicSpecToLatest = (blob: unknown): PublicSpecQuiz =>
  runSpecChain(blob, publicSpecSteps, "public spec") as PublicSpecQuiz

export const migrateModelSolutionToLatest = (blob: unknown): ModelSolutionQuiz | null => {
  if (blob === null || blob === undefined) {
    return null
  }
  return runSpecChain(blob, modelSolutionSteps, "model solution") as ModelSolutionQuiz
}

// Answer steps need the already-migrated spec, because the v1->v2 step reads each answered item's
// (migrated) type from it. So the spec must be migrated to latest and passed in first.
type AnswerMigrationStep = (
  answer: unknown,
  migratedSpec: PrivateSpecQuiz | PublicSpecQuiz,
) => unknown
const answerSteps: Partial<Record<QuizSpecVersion, AnswerMigrationStep>> = {
  "1": (answer, spec) => migrateQuizAnswer(answer as OldQuizAnswer, spec),
  "2": (answer) => migrateUserAnswerV2ToV3(answer as UserAnswerV2),
  "3": (answer) => migrateUserAnswerV3ToV4(answer as UserAnswerV3),
}

export const migrateUserAnswerToLatest = (
  blob: unknown,
  migratedSpec: PrivateSpecQuiz | PublicSpecQuiz,
): UserAnswer | null => {
  if (blob === null || blob === undefined) {
    return null
  }
  let current: unknown = blob
  let version = detectQuizVersion(current)
  const visited = new Set<QuizSpecVersion>()
  while (version !== LATEST_QUIZ_VERSION) {
    visited.add(version)
    const step = answerSteps[version]
    if (!step) {
      throw new Error(`No user answer migration step from version '${version}'`)
    }
    current = step(current, migratedSpec)
    if (current === null || current === undefined) {
      return null
    }
    const next = detectQuizVersion(current)
    if (visited.has(next)) {
      throw new Error(
        `User answer migration step from version '${version}' did not advance the version (emitted '${next}')`,
      )
    }
    version = next
  }
  return current as UserAnswer
}

/** A fresh, empty private spec at the latest version. The only place an empty spec is built. */
export const createEmptyPrivateSpec = (): PrivateSpecQuiz => ({
  version: LATEST_QUIZ_VERSION,
  title: null,
  body: null,
  awardPointsEvenIfWrong: false,
  grantPointsPolicy: "grant_whenever_possible",
  quizItemDisplayDirection: "vertical",
  feedbackMessages: [],
  items: [],
})
