import type {
  NewTeacherGradingDecision,
  TeacherDecisionType,
} from "@/generated/api/types.generated"

export type GradingMode =
  | "award-points"
  | "reject-and-reset"
  | "suspected-plagiarism"
  | "unauthorized-ai-use"

export interface GradingDecisionFormValues {
  mode: GradingMode
  points: number | null
  feedback: string
}

export interface GradingTarget {
  userExerciseStateId: string
  exerciseId: string
  exerciseMaxPoints: number
}

const FULL_POINTS_TOLERANCE = 1e-9

/** Maps a mode + points value to the backend decision type. Reject/plagiarism/AI-use always zero the points server-side. */
export function resolveAction(
  mode: GradingMode,
  points: number | null,
  exerciseMaxPoints: number,
): TeacherDecisionType {
  switch (mode) {
    case "reject-and-reset":
      return "RejectAndReset"
    case "suspected-plagiarism":
      return "SuspectedPlagiarism"
    case "unauthorized-ai-use":
      return "UnauthorizedAiUse"
    case "award-points": {
      const value = points ?? 0
      if (value <= FULL_POINTS_TOLERANCE) {
        return "ZeroPoints"
      }
      if (Math.abs(value - exerciseMaxPoints) < FULL_POINTS_TOLERANCE) {
        return "FullPoints"
      }
      return "CustomPoints"
    }
  }
}

export function buildGradingDecision(
  values: GradingDecisionFormValues,
  target: GradingTarget,
): NewTeacherGradingDecision {
  const action = resolveAction(values.mode, values.points, target.exerciseMaxPoints)
  const trimmedFeedback = values.feedback.trim()
  return {
    user_exercise_state_id: target.userExerciseStateId,
    exercise_id: target.exerciseId,
    action,
    manual_points: values.mode === "award-points" ? (values.points ?? 0) : null,
    justification: action === "FullPoints" || trimmedFeedback === "" ? null : trimmedFeedback,
    hidden: false,
  }
}
