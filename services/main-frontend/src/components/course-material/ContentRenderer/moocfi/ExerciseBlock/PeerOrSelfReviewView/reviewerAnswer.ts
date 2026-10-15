import type { ExerciseTaskSubmission } from "@/generated/course-material-api/types.generated"
import { storedAnswerToViewSubmissionFields } from "@/shared-module/common/utils/typeMappter"
import type { AnswerFileRef } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

/**
 * The answer fields of a reviewer's `view-submission` state, with the submitter's filenames
 * replaced by positional ones and the grading order left alone.
 *
 * A reviewer must not learn who wrote the answer, and an uploaded filename often says so outright.
 * Plugins that offer students filename anonymization keep their display names in the answer itself,
 * so those still reach the reviewer.
 */
export function reviewerAnswerFields(
  previousSubmission: ExerciseTaskSubmission | null | undefined,
) {
  const fields = storedAnswerToViewSubmissionFields(previousSubmission)
  if (!fields.user_answer_files) {
    return fields
  }
  return {
    ...fields,
    user_answer_files: fields.user_answer_files.map((file, index) => ({
      ...file,
      name: `file-${index + 1}`,
    })),
  }
}

/**
 * The name a reviewer's download of `url` saves as: the positional name
 * {@link reviewerAnswerFields} gave that file, or a bare `file` for a URL the answer does not list.
 *
 * The name a plugin passes to `download-file` is never used here: a plugin is free to hand back the
 * submitter's own, which would undo the renaming above.
 */
export function reviewerDownloadFileName(
  files: readonly AnswerFileRef[] | undefined,
  url: string,
): string {
  return files?.find((file) => file.url === url)?.name ?? "file"
}
