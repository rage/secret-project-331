import { uploadFilesFromExerciseService } from "@/generated/api/sdk.generated"
import type { FileUploadResultEntry } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

const isUploadResultEntry = (value: unknown): value is FileUploadResultEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === "string" &&
  typeof (value as Record<string, unknown>).url === "string"

/**
 * The sole main-frontend adapter for iframe uploads. The iframe supplies only browser files; this
 * host assigns UUID multipart field names and the backend echoes those ids in input order.
 */
export async function uploadFilesFromExerciseIframe(
  exerciseServiceSlug: string,
  files: readonly File[],
): Promise<FileUploadResultEntry[]> {
  const uploads = files.map((file) => [crypto.randomUUID(), file] as const)
  const ids = uploads.map(([id]) => id)
  const body = Object.fromEntries(uploads)
  const response = await uploadFilesFromExerciseService({
    body,
    path: { exercise_service_slug: exerciseServiceSlug },
  })
  if (
    !Array.isArray(response) ||
    !response.every((entry) => isUploadResultEntry(entry)) ||
    response.length !== files.length ||
    response.some((entry, index) => entry.id !== ids[index])
  ) {
    throw new Error("The upload service returned an invalid file result")
  }
  return response
}
