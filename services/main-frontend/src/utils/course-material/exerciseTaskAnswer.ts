import type { StudentExerciseTaskSubmission } from "@/generated/course-material-api/types.generated"

const JSON_ANSWER_KIND = "json"
const FILE_ANSWER_KIND = "file"

/** What an exercise task's iframe last reported as its answer via `current-state`. */
export interface CapturedExerciseTaskAnswer {
  valid: boolean
  data: unknown
  /** Host file ids; present makes the answer file-typed. */
  files?: string[]
  validityMessages?: string[]
}

/** The submit body for one exercise task. An uncaptured task submits an empty JSON answer. */
export function capturedAnswerToTaskSubmission(
  exerciseTaskId: string,
  answer: CapturedExerciseTaskAnswer | undefined,
): StudentExerciseTaskSubmission {
  if (answer?.files) {
    return {
      exercise_task_id: exerciseTaskId,
      answer_kind: FILE_ANSWER_KIND,
      data_json: answer.data ?? null,
      data_files: answer.files,
    }
  }
  return {
    exercise_task_id: exerciseTaskId,
    answer_kind: JSON_ANSWER_KIND,
    data_json: answer?.data ?? null,
  }
}
