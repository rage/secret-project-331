// This file is here because the grading request types does not play nice with the type guard generation.

/**
 * from: backend
 *
 * to: exercise service
 */
export type GradingRequest<S = unknown, D = unknown> = {
  exercise_spec: S
  submission_data: D
}

export type GradingResult<F = unknown> = {
  grading_progress: "FullyGraded" | "Pending" | "PendingManual" | "Failed"
  score_given: number
  score_maximum: number
  feedback_text: string | null
  feedback_json: F
  /** Variables set here will be visible to the iframe views for this user on this course. Can be used to remember things like remembering names. */
  set_user_variables?: { [key: string]: unknown }
}
