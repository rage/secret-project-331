import { ExerciseTaskGrading, ExerciseTaskGradingResult } from "../bindings"

export function exerciseTaskGradingToExerciseTaskGradingResult(
  input: ExerciseTaskGrading | null,
): ExerciseTaskGradingResult | null {
  if (!input) {
    return null
  }
  return {
    grading_progress: input.grading_progress,
    score_given: input.unscaled_score_given ?? 0,
    score_maximum: input.unscaled_score_maximum ?? 0,
    feedback_text: input.feedback_text,
    feedback_json: input.feedback_json,
    set_user_variables: input.set_user_variables,
  }
}
