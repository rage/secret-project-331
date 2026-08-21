import type { ExerciseTaskGradingResult } from "../exerciseServiceTypes"

type AnswerDataLike = { kind: "json"; data: unknown } | { kind: "file"; metadata?: unknown }

/**
 * The plain JSON an exercise plugin's IFrame expects as a previous answer, from the
 * `AnswerData`/`SubmittedAnswer` union the API returns. There is no file-rendering support yet,
 * so a file-kind answer yields its metadata rather than the files.
 */
export function answerDataToPluginAnswer(answer: AnswerDataLike | null | undefined): unknown {
  if (!answer) {
    return null
  }
  return answer.kind === "json" ? answer.data : (answer.metadata ?? null)
}

interface ExerciseTaskGradingLike {
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
