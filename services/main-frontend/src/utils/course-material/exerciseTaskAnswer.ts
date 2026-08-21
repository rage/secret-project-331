import type { SubmittedAnswer } from "@/generated/course-material-api/types.generated"

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
export function capturedAnswerToSubmittedAnswer(
  answer: CapturedExerciseTaskAnswer | undefined,
): SubmittedAnswer {
  if (answer?.files) {
    return {
      kind: FILE_ANSWER_KIND,
      file_upload_ids: answer.files,
      metadata: answer.data ?? null,
    }
  }
  return { kind: JSON_ANSWER_KIND, data: answer?.data }
}
