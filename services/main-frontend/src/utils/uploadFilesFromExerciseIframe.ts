import { v4 } from "uuid"

import {
  uploadFilesForExerciseAnswer,
  uploadFilesFromExerciseService,
} from "@/generated/api/sdk.generated"
import type { FileUploadResultEntry } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

const isUploadResultEntry = (value: unknown): value is FileUploadResultEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === "string" &&
  typeof (value as Record<string, unknown>).url === "string"

const validateUploadResponse = (
  response: unknown,
  expectedCount: number,
): FileUploadResultEntry[] => {
  if (
    !Array.isArray(response) ||
    response.length !== expectedCount ||
    !response.every((entry) => isUploadResultEntry(entry))
  ) {
    throw new Error("The upload service returned an invalid file result")
  }
  return response
}

/**
 * Assigns UUID multipart field names to each file and re-materializes it into an in-memory `File`.
 *
 * Uses `uuid`'s `v4` rather than `crypto.randomUUID` on purpose: the course-material iframe host is
 * served over plain HTTP from a custom hostname (e.g. `http://project-331.local/...`), which is not
 * a secure context, and `crypto.randomUUID` is only defined in secure contexts (HTTPS / localhost).
 * `v4` falls back to `crypto.getRandomValues`, which works in insecure contexts too.
 *
 * The files arrive from the sandboxed iframe over postMessage. Uploading those objects as-is makes
 * Chrome treat the multipart body as a streaming upload, which it only allows over HTTP/2 or QUIC —
 * so on the plain-HTTP dev host the POST fails at the network layer with net::ERR_H2_OR_QUIC_REQUIRED
 * before reaching the backend. Re-materializing each file into an in-memory `File` (backed by a known
 * ArrayBuffer) gives the body a concrete byte source, so the browser sends a normal buffered upload.
 *
 * Field names must stay UUIDs, not integer-like keys: the body is built with `Object.fromEntries`,
 * and integer-like keys would reorder in the resulting object. Order is the only correlation between
 * request and response: the backend returns results in request order and never echoes field names.
 */
const buildMultipartBody = async (files: readonly File[]): Promise<Record<string, File>> =>
  Object.fromEntries(
    await Promise.all(
      files.map(
        async (file) =>
          [v4(), new File([await file.arrayBuffer()], file.name, { type: file.type })] as const,
      ),
    ),
  )

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
