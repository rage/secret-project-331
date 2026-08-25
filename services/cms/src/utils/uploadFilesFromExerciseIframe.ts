import { uploadFilesFromExerciseService } from "@/generated/api/sdk.generated"
import {
  buildMultipartBody,
  validateUploadResponse,
} from "@/shared-module/common/utils/exerciseIframeUploadBody"
import type { FileUploadResultEntry } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

/**
 * Uploads files a teacher attached in an exercise service's editor iframe, under the exercise
 * service's own slug.
 *
 * Deliberately not the answer-upload route: those uploads are bound to an exercise task and reaped
 * unless a submission names them, and an editor's files are only ever referenced from a private
 * spec, which the host never inspects.
 */
export async function uploadFilesFromExerciseServiceEditor(
  exerciseServiceSlug: string,
  files: readonly File[],
): Promise<FileUploadResultEntry[]> {
  const body = await buildMultipartBody(files)
  const response = await uploadFilesFromExerciseService({
    body,
    path: { exercise_service_slug: exerciseServiceSlug },
  })
  return validateUploadResponse(response, files.length)
}
