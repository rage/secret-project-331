import {
  isAlternative,
  isObject,
  isPublicAlternative,
  type Alternative,
  type Answer,
  type ModelSolutionApi,
  type PublicAlternative,
} from "@/util/stateInterfaces"

import { detectVersion, LATEST_SPEC_VERSION, type SpecVersion } from "./versions"

/**
 * The one place old stored blobs are lifted to the current version (reference/07 #1). The host keeps
 * old blobs forever, so every door — public-spec/model-solution endpoints, grade, CSV exports, and
 * the editor/answer/submission iframe — calls one `migrate*ToLatest` and never sees version logic.
 * Modelled after quizzes' `migrateToLatest.ts`. At v1 every registry is empty and each chain is just
 * its `normalize*` (validate the v1 shape, return it).
 *
 * Adding v2: bump `LATEST_SPEC_VERSION` in `versions.ts`, snapshot the v1 shape, write the v1->v2
 * step, add one line per registry (`"1": (b) => migrateXxxV1ToV2(b as XxxV1)`), and update the
 * matching `normalize*`. No door changes needed — that is the point of this module.
 */

/** A step migrates a blob up exactly one version. Keyed by the version it accepts. */
type MigrationStep = (blob: unknown) => unknown
type MigrationSteps = Partial<Record<SpecVersion, MigrationStep>>

/**
 * Runs the migration chain for one blob kind: detect the version, apply steps until
 * `LATEST_SPEC_VERSION`, then validate the latest shape. Throws (via `detectVersion`) on an
 * unknown/future version. `normalize` returns `null` when the value is an unrecognizable shape, so
 * each door keeps its own posture (server → 400, iframe → default).
 */
function runChain<T>(
  blob: unknown,
  steps: MigrationSteps,
  normalize: (blob: unknown) => T | null,
  kind: string,
): T | null {
  let current = blob
  // `string`, not `SpecVersion`: at v1 the loop is dead code, which would narrow the body to `never`.
  let version: string = detectVersion(current)
  const visited = new Set<string>()
  while (version !== LATEST_SPEC_VERSION) {
    visited.add(version)
    const step = steps[version as SpecVersion]
    if (!step) {
      throw new Error(`No ${kind} migration step from version '${version}'`)
    }
    current = step(current)
    const next: string = detectVersion(current)
    // A step that stalls or downgrades would loop forever; fail loud instead.
    if (visited.has(next)) {
      throw new Error(
        `${kind} migration step from version '${version}' did not advance the version`,
      )
    }
    version = next
  }
  return normalize(current)
}

// Private spec: stored as the legacy bare `Alternative[]` or the `{ version, alternatives }`
// envelope. Elements are NOT filtered here — server doors validate them strictly and 400 (the
// forgiving `parsePrivateSpec` below filters instead).
const normalizePrivateSpec = (blob: unknown): Alternative[] | null => {
  if (Array.isArray(blob)) {
    return blob as Alternative[]
  }
  if (isObject(blob) && Array.isArray(blob.alternatives)) {
    return blob.alternatives as Alternative[]
  }
  return null
}
const privateSpecSteps: MigrationSteps = {}
export const migratePrivateSpecToLatest = (blob: unknown): Alternative[] | null =>
  runChain(blob, privateSpecSteps, normalizePrivateSpec, "private spec")

// Public spec: stored as a bare array today; a future `{ version, options }` envelope is accepted
// too. Non-`PublicAlternative` elements are dropped (world-readable, so stay defensive).
const normalizePublicSpec = (blob: unknown): PublicAlternative[] | null => {
  if (Array.isArray(blob)) {
    // oxlint-disable-next-line unicorn/no-array-callback-reference -- type guard; wrapping drops narrowing
    return blob.filter(isPublicAlternative)
  }
  if (isObject(blob) && Array.isArray(blob.options)) {
    // oxlint-disable-next-line unicorn/no-array-callback-reference -- type guard; wrapping drops narrowing
    return blob.options.filter(isPublicAlternative)
  }
  return null
}
const publicSpecSteps: MigrationSteps = {}
export const migratePublicSpecToLatest = (blob: unknown): PublicAlternative[] | null =>
  runChain(blob, publicSpecSteps, normalizePublicSpec, "public spec")

// Model solution: stored bare `{ correctOptionIds }` or `{ version, correctOptionIds }`.
const normalizeModelSolution = (blob: unknown): ModelSolutionApi | null => {
  if (
    isObject(blob) &&
    Array.isArray(blob.correctOptionIds) &&
    blob.correctOptionIds.every((id): id is string => typeof id === "string")
  ) {
    return { correctOptionIds: blob.correctOptionIds }
  }
  return null
}
const modelSolutionSteps: MigrationSteps = {}
export const migrateModelSolutionToLatest = (blob: unknown): ModelSolutionApi | null =>
  runChain(blob, modelSolutionSteps, normalizeModelSolution, "model solution")

// Answer: stored bare `{ selectedOptionId }` or `{ version, selectedOptionId }`. Self-sufficient for
// grading (reference/07 #6), so unlike quizzes it needs no migrated spec passed in.
const normalizeAnswer = (blob: unknown): Answer | null =>
  isObject(blob) && typeof blob.selectedOptionId === "string"
    ? { selectedOptionId: blob.selectedOptionId }
    : null
const answerSteps: MigrationSteps = {}
export const migrateAnswerToLatest = (blob: unknown): Answer | null =>
  runChain(blob, answerSteps, normalizeAnswer, "answer")

// Forgiving iframe wrappers (reference/07 #9): postMessage `data` is untyped, so a malformed field or
// an unliftable version must degrade to a default, not crash the view. These swallow the fail-loud
// throw and the `null` from the raw `migrate*` above.

const forgiving = <T>(migrate: () => T | null, fallback: T): T => {
  try {
    return migrate() ?? fallback
  } catch {
    return fallback
  }
}

export const parsePrivateSpec = (value: unknown): Alternative[] =>
  // oxlint-disable-next-line unicorn/no-array-callback-reference -- type guard; wrapping drops narrowing
  forgiving(() => migratePrivateSpecToLatest(value), []).filter(isAlternative)

export const parsePublicSpec = (value: unknown): PublicAlternative[] =>
  forgiving(() => migratePublicSpecToLatest(value), [])

export const parseModelSolution = (value: unknown): ModelSolutionApi | null =>
  forgiving(() => migrateModelSolutionToLatest(value), null)

export const parseAnswer = (value: unknown): Answer =>
  forgiving(() => migrateAnswerToLatest(value), { selectedOptionId: "" })

// The host replays the student's last answer as `previous_submission` on retry. Returns `null` (not
// an empty answer) when there is nothing to prefill, so the answer view can tell "no prior answer"
// from "answered with an empty id".
export const parsePreviousSubmission = (value: unknown): Answer | null => {
  const answer = forgiving(() => migrateAnswerToLatest(value), null)
  return answer && answer.selectedOptionId !== "" ? answer : null
}
