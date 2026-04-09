import { ExerciseTaskGradingResult } from "../exerciseServiceTypes"

type ExerciseTaskGradingLike = {
  grading_progress: ExerciseTaskGradingResult["grading_progress"]
  unscaled_score_given?: number | null
  unscaled_score_maximum?: number | null
  feedback_text?: string | null
  feedback_json?: unknown
}

export function exerciseTaskGradingToExerciseTaskGradingResult(
  input: ExerciseTaskGradingLike | null | undefined,
): ExerciseTaskGradingResult | null {
  if (!input) {
    return null
  }
  return {
    grading_progress: input.grading_progress,
    score_given: input.unscaled_score_given ?? 0,
    score_maximum: input.unscaled_score_maximum ?? 0,
    feedback_text: input.feedback_text ?? null,
    feedback_json: input.feedback_json ?? null,
  }
}
