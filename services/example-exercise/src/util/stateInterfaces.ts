import { LATEST_SPEC_VERSION } from "./migration/versions"

export interface PublicAlternative {
  id: string
  name: string
}

export interface Alternative {
  id: string
  name: string
  correct: boolean
}

export interface Answer {
  selectedOptionId: string
}

export interface ClientErrorResponse {
  message: string
}

export interface ModelSolutionApi {
  correctOptionIds: string[]
}

export interface ExerciseFeedback {
  selectedOptionIsCorrect: boolean
}

// Versioning (reference/07 #1): specs, answers and feedback are stored forever in a DB we cannot
// migrate, so every stored shape carries a `version`. The interfaces above are the internal runtime
// shapes; the `Versioned*` types below are the stored/wire shapes, lifted on read only by
// `migration/migrateToLatest.ts`.
export const SPEC_VERSION = LATEST_SPEC_VERSION

/** Stored private spec: the bare `Alternative[]` wrapped so it can gain a version. */
export interface VersionedPrivateSpec {
  version: typeof SPEC_VERSION
  alternatives: Alternative[]
}

/** Stored public spec: the `PublicAlternative[]` wrapped so it can carry a version. */
export interface VersionedPublicSpec {
  version: typeof SPEC_VERSION
  options: PublicAlternative[]
}

/** Stored answer: `version` sits alongside the payload so `data.selectedOptionId` still reads. */
export interface VersionedAnswer {
  version: typeof SPEC_VERSION
  selectedOptionId: string
}

/** Stored model solution: `version` alongside the ids. */
export interface VersionedModelSolution {
  version: typeof SPEC_VERSION
  correctOptionIds: string[]
}

/** Stored grading feedback: `version` alongside the payload. */
export interface VersionedExerciseFeedback {
  version: typeof SPEC_VERSION
  selectedOptionIsCorrect: boolean
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/** persist-on-save: wrap the internal alternatives in the current versioned envelope. */
export function toVersionedPrivateSpec(alternatives: Alternative[]): VersionedPrivateSpec {
  return { version: SPEC_VERSION, alternatives }
}

export function toVersionedPublicSpec(options: PublicAlternative[]): VersionedPublicSpec {
  return { version: SPEC_VERSION, options }
}

export function toVersionedAnswer(selectedOptionId: string): VersionedAnswer {
  return { version: SPEC_VERSION, selectedOptionId }
}

export function toVersionedModelSolution(correctOptionIds: string[]): VersionedModelSolution {
  return { version: SPEC_VERSION, correctOptionIds }
}

export function toVersionedFeedback(selectedOptionIsCorrect: boolean): VersionedExerciseFeedback {
  return { version: SPEC_VERSION, selectedOptionIsCorrect }
}

// Validity is a separate judgement from parseability (reference/07 #7): the editor can hold a
// half-finished spec that parses fine but is not yet safe to save/derive/grade. `validatePrivateSpec`
// is the single authority for that judgement — the editor uses it both to set the emitted `valid`
// flag AND to show the errors to the author. Errors are i18n keys so the caller can localize them.
/** Every error `validatePrivateSpec` can report; each is also a locale key. */
export const PRIVATE_SPEC_VALIDATION_ERRORS = [
  "validation-error-no-options",
  "validation-error-no-correct-option",
  "validation-error-empty-option-name",
] as const
export type PrivateSpecValidationError = (typeof PRIVATE_SPEC_VALIDATION_ERRORS)[number]

export interface PrivateSpecValidation {
  valid: boolean
  errors: PrivateSpecValidationError[]
}

export function validatePrivateSpec(spec: Alternative[]): PrivateSpecValidation {
  const errors: PrivateSpecValidationError[] = []
  if (spec.length === 0) {
    errors.push("validation-error-no-options")
  }
  if (!spec.some((alternative) => alternative.correct)) {
    errors.push("validation-error-no-correct-option")
  }
  if (spec.some((alternative) => alternative.name.trim() === "")) {
    errors.push("validation-error-empty-option-name")
  }
  return { valid: errors.length === 0, errors }
}

export function isAlternative(value: unknown): value is Alternative {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.correct === "boolean"
  )
}

export function isPublicAlternative(value: unknown): value is PublicAlternative {
  return isObject(value) && typeof value.id === "string" && typeof value.name === "string"
}

// Reading stored blobs (the forgiving iframe `parse*` and the strict `migrate*ToLatest`) lives in
// `migration/migrateToLatest.ts` — the single migration door for every version.
