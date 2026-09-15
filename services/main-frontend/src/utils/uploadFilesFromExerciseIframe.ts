import {
  uploadFilesForExerciseAnswer,
  uploadFilesFromExerciseService,
} from "@/generated/api/sdk.generated"
import {
  buildMultipartBody,
  validateUploadResponse,
} from "@/shared-module/common/utils/exerciseIframeUploadBody"
import type { FileUploadResultEntry } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

/**
 * Uploads files an iframe exercise task collected from the student, binding each upload to the
 * given exercise task so a later submit can verify the student is naming their own files.
 */
export async function uploadFilesForExerciseTaskAnswer(
  exerciseTaskId: string,
  files: readonly File[],
): Promise<FileUploadResultEntry[]> {
  const body = await buildMultipartBody(files)
  const response = await uploadFilesForExerciseAnswer({
    body,
    path: { exercise_task_id: exerciseTaskId },
  })
  return validateUploadResponse(response, files.length)
}

/**
 * Uploads files from an iframe with no exercise task to bind them to, e.g. the playground. Pass
 * the exercise service's slug (or `"playground"`, the backend's escape hatch for the playground).
 */
export async function uploadFilesFromExerciseServiceIframe(
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
