import { produce } from "immer"

import type {
  CourseMaterialExercise,
  StudentExerciseSlideSubmissionResult,
} from "@/generated/course-material-api/types.generated"

/**
 * The cached exercise as the server will return it after this submission, so "Try again" can
 * restore the answer without a reload.
 *
 * Must match the follow-up refetch: any difference re-renders the iframe once more in between,
 * and the height change shifts the buttons below it under the user's click.
 */
export function withSubmissionResult(
  exercise: CourseMaterialExercise,
  result: StudentExerciseSlideSubmissionResult,
): CourseMaterialExercise {
  return produce(exercise, (draft) => {
    result.exercise_task_submission_results.forEach((taskResult) => {
      const task = draft.current_exercise_slide.exercise_tasks.find(
        (et) => et.id === taskResult.submission.exercise_task_id,
      )
      if (task) {
        task.previous_submission = taskResult.submission
        task.previous_submission_grading = taskResult.grading ?? null
        task.model_solution_spec = taskResult.model_solution_spec ?? null
      }
    })
  })
}
