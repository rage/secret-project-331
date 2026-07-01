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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

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

export function isExerciseFeedback(value: unknown): value is ExerciseFeedback {
  return isObject(value) && typeof value.selectedOptionIsCorrect === "boolean"
}

// The iframe receives its state as untyped `data` over postMessage, so the helpers below narrow it
// defensively. They are forgiving (returning empty/default values) because a missing or malformed
// field should not crash the view.

export function parsePublicSpec(value: unknown): PublicAlternative[] {
  return Array.isArray(value) ? value.filter(isPublicAlternative) : []
}

export function parsePrivateSpec(value: unknown): Alternative[] {
  return Array.isArray(value) ? value.filter(isAlternative) : []
}

export function parseAnswer(value: unknown): Answer {
  return isObject(value) && typeof value.selectedOptionId === "string"
    ? { selectedOptionId: value.selectedOptionId }
    : { selectedOptionId: "" }
}

export function parseModelSolution(value: unknown): ModelSolutionApi | null {
  if (
    isObject(value) &&
    Array.isArray(value.correctOptionIds) &&
    value.correctOptionIds.every((id): id is string => typeof id === "string")
  ) {
    return { correctOptionIds: value.correctOptionIds }
  }
  return null
}
