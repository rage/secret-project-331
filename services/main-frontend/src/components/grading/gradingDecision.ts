import type {
  NewTeacherGradingDecision,
  TeacherDecisionType,
} from "@/generated/api/types.generated"

/** Why an answer was given zero points. Only asked for once the points reach zero. */
export type GradingReason = "bad-answer" | "plagiarism" | "unauthorized-ai-use" | "other"

export interface GradingDecisionFormValues {
  points: number | null
  reason: GradingReason
  /** Lets the student answer the exercise again. Independent of the reason. */
  resetExercise: boolean
  feedback: string
}

export interface GradingTarget {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
}

const FULL_POINTS_TOLERANCE = 1e-9

export function isZeroPoints(points: number | null): boolean {
  return (points ?? 0) <= FULL_POINTS_TOLERANCE
}

export function isFullPoints(points: number | null, exerciseMaxPoints: number): boolean {
  return Math.abs((points ?? 0) - exerciseMaxPoints) < FULL_POINTS_TOLERANCE
}

/** Maps the form state to the backend decision type. The reason only applies at zero points. */
export function resolveAction(
  points: number | null,
  reason: GradingReason,
  exerciseMaxPoints: number,
): TeacherDecisionType {
  if (!isZeroPoints(points)) {
    return isFullPoints(points, exerciseMaxPoints) ? "FullPoints" : "CustomPoints"
  }
  switch (reason) {
    case "bad-answer":
      return "BadAnswer"
    case "plagiarism":
      return "SuspectedPlagiarism"
    case "unauthorized-ai-use":
      return "UnauthorizedAiUse"
    case "other":
      return "Other"
  }
}

export function buildGradingDecision(
  values: GradingDecisionFormValues,
  target: GradingTarget,
): NewTeacherGradingDecision {
  const action = resolveAction(values.points, values.reason, target.exerciseMaxPoints)
  const trimmedFeedback = values.feedback.trim()
  return {
    user_exercise_state_id: target.userExerciseStateId,
    exercise_id: target.exerciseId,
    action,
    manual_points: action === "CustomPoints" ? (values.points ?? 0) : null,
    justification: action === "FullPoints" || trimmedFeedback === "" ? null : trimmedFeedback,
    hidden: false,
    reset_exercise: isZeroPoints(values.points) && values.resetExercise,
  }
}
