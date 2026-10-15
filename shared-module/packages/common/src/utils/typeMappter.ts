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

/** A submission row as the API returns it: the answer's JSON, and its files beside it. */
interface StoredAnswerLike {
  data_json?: unknown
  data_files?: AnswerFileLike[] | null
}

interface PluginAnswer {
  data: unknown
  files?: AnswerFileRef[]
}

function toPluginAnswer(stored: StoredAnswerLike | null | undefined): PluginAnswer {
  if (!stored) {
    return { data: null }
  }
  return {
    data: stored.data_json ?? null,
    ...omitUndefined({ files: answerFilesToAnswerFileRefs(stored.data_files) }),
  }
}

/**
 * A stored answer's files as the iframe protocol carries them, or `undefined` when it has none.
 *
 * The file order is the host's grading order and must not be re-sorted.
 */
export function answerFilesToAnswerFileRefs(
  files: AnswerFileLike[] | null | undefined,
): AnswerFileRef[] | undefined {
  if (!files || files.length === 0) {
    return undefined
  }
  return files.map((file) => ({
    id: file.id,
    url: file.url,
    name: file.name,
    mime: file.mime,
    // A file stored before sizes were recorded has no size; a zero would report a false one.
    ...omitUndefined({ size_bytes: file.size_bytes ?? undefined }),
  }))
}

/**
 * Both answer fields of a `view-submission` iframe state, from the submission row the API returns.
 *
 * Spread the result into the state's `data` so a file answer cannot reach a plugin with its files
 * dropped. See {@link storedAnswerToAnswerExerciseFields} for the `answer-exercise` view's
 * differently named pair.
 */
export function storedAnswerToViewSubmissionFields(stored: StoredAnswerLike | null | undefined): {
  user_answer: unknown
  user_answer_files?: AnswerFileRef[]
} {
  const { data, files } = toPluginAnswer(stored)
  return { user_answer: data, ...omitUndefined({ user_answer_files: files }) }
}

/**
 * Both answer fields of an `answer-exercise` iframe state, from the submission row the API returns.
 *
 * Spread the result into the state's `data`; see {@link storedAnswerToViewSubmissionFields}.
 */
export function storedAnswerToAnswerExerciseFields(stored: StoredAnswerLike | null | undefined): {
  previous_submission: unknown
  previous_submission_files?: AnswerFileRef[]
} {
  const { data, files } = toPluginAnswer(stored)
  return { previous_submission: data, ...omitUndefined({ previous_submission_files: files }) }
}

/**
 * A stored answer as the fields a submit path captures from a plugin's `current-state` message, so
 * restoring a previous answer resubmits it as the same kind rather than downgrading it to JSON.
 *
 * `files` holds host file ids, not the refs the iframe states carry.
 */
export function storedAnswerToCapturedAnswerFields(stored: StoredAnswerLike | null | undefined): {
  data: unknown
  files?: string[]
} {
  const { data, files } = toPluginAnswer(stored)
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
