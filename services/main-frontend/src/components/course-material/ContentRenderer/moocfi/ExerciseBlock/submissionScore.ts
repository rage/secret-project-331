import type { StudentExerciseSlideSubmissionResult } from "@/generated/course-material-api/types.generated"

// This submission's score; exercise_status.score_given is the best score so far, which would
// contradict the iframe's "not correct" after a worse retry.
export const getSubmissionScore = (data: StudentExerciseSlideSubmissionResult): number | null => {
  const gradings = data.exercise_task_submission_results.map((r) => r.grading?.score_given)
  if (gradings.length > 0 && gradings.every((s) => s !== null && s !== undefined)) {
    return gradings.reduce<number>((sum, s) => sum + (s ?? 0), 0)
  }
  return data.exercise_status?.score_given ?? null
}
