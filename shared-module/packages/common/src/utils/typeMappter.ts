import type { AnswerFileRef } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

import type { ExerciseTaskGradingResult } from "../exerciseServiceTypes"
import { omitUndefined } from "./nullability"

interface AnswerFileLike {
  id: string
  url: string
  name: string
  mime: string
  size_bytes?: number | null
}

type AnswerDataLike =
  | { kind: "json"; data: unknown }
  | { kind: "file"; files: AnswerFileLike[]; metadata?: unknown }

interface PluginAnswer {
  data: unknown
  files?: AnswerFileRef[]
}

function toPluginAnswer(answer: AnswerDataLike | null | undefined): PluginAnswer {
  if (!answer) {
    return { data: null }
  }
  if (answer.kind === "json") {
    return { data: answer.data }
  }
  return {
    data: answer.metadata ?? null,
    files: answer.files.map((file) => ({
      id: file.id,
      url: file.url,
      name: file.name,
      mime: file.mime,
      // A file stored before sizes were recorded has no size; a zero would report a false one.
      ...omitUndefined({ size_bytes: file.size_bytes ?? undefined }),
    })),
  }
}

/**
 * Both answer fields of a `view-submission` iframe state, from the `AnswerData` the API returns.
 *
 * Spread the result into the state's `data` so a file-typed answer cannot reach a plugin with its
 * files dropped. The file order is the host's grading order and must not be re-sorted. See
 * {@link answerDataToAnswerExerciseFields} for the `answer-exercise` view's differently named pair.
 */
export function answerDataToViewSubmissionFields(answer: AnswerDataLike | null | undefined): {
  user_answer: unknown
  user_answer_files?: AnswerFileRef[]
} {
  const { data, files } = toPluginAnswer(answer)
  return { user_answer: data, ...omitUndefined({ user_answer_files: files }) }
}

/**
 * Both answer fields of an `answer-exercise` iframe state, from the `AnswerData` the API returns.
 *
 * Spread the result into the state's `data`; see {@link answerDataToViewSubmissionFields}.
 */
export function answerDataToAnswerExerciseFields(answer: AnswerDataLike | null | undefined): {
  previous_submission: unknown
  previous_submission_files?: AnswerFileRef[]
} {
  const { data, files } = toPluginAnswer(answer)
  return { previous_submission: data, ...omitUndefined({ previous_submission_files: files }) }
}

/**
 * A stored answer as the fields a submit path captures from a plugin's `current-state` message, so
 * restoring a previous answer resubmits it as the same kind rather than downgrading it to JSON.
 *
 * `files` holds host file ids, not the refs the iframe states carry.
 */
export function answerDataToCapturedAnswerFields(answer: AnswerDataLike | null | undefined): {
  data: unknown
  files?: string[]
} {
  const { data, files } = toPluginAnswer(answer)
  return { data, ...omitUndefined({ files: files?.map((file) => file.id) }) }
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
