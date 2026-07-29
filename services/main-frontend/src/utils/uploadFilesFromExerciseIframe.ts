import { v4 } from "uuid"

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
 *
 * Uses `uuid`'s `v4` rather than `crypto.randomUUID` on purpose: the course-material iframe host is
 * served over plain HTTP from a custom hostname (e.g. `http://project-331.local/...`), which is not
 * a secure context, and `crypto.randomUUID` is only defined in secure contexts (HTTPS / localhost).
 * `v4` falls back to `crypto.getRandomValues`, which works in insecure contexts too.
 */
export async function uploadFilesFromExerciseIframe(
  exerciseServiceSlug: string,
  files: readonly File[],
): Promise<FileUploadResultEntry[]> {
  const uploads = files.map((file) => [v4(), file] as const)
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
