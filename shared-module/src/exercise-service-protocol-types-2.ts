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
