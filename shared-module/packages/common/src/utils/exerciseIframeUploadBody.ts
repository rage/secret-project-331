import { v4 } from "uuid"

import type { FileUploadResultEntry } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

const isUploadResultEntry = (value: unknown): value is FileUploadResultEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Record<string, unknown>).id === "string" &&
  typeof (value as Record<string, unknown>).url === "string"

/**
 * Checks that an upload endpoint returned one `{ id, url }` entry per requested file, in order.
 *
 * @throws if the response is not a list of that exact length and shape.
 */
export const validateUploadResponse = (
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
 * `uuid`'s `v4`, not `crypto.randomUUID`: the iframe hosts run on plain-HTTP custom hostnames
 * (e.g. `http://project-331.local`), not a secure context, where `crypto.randomUUID` is undefined;
 * `v4` falls back to `crypto.getRandomValues`, which works there.
 *
 * Files arrive from the sandboxed iframe over postMessage; uploading them as-is makes Chrome treat
 * the body as a streaming upload (HTTP/2-or-QUIC only), which fails with
 * net::ERR_H2_OR_QUIC_REQUIRED on the plain-HTTP dev host. Re-materializing into an in-memory
 * `File` backed by a known ArrayBuffer forces a normal buffered upload instead.
 *
 * Field names must stay UUIDs: `Object.fromEntries` reorders integer-like keys, and order is the
 * only correlation between request and response — the backend returns results in request order
 * and never echoes field names.
 */
export const buildMultipartBody = async (files: readonly File[]): Promise<Record<string, File>> =>
  Object.fromEntries(
    await Promise.all(
      files.map(
        async (file) =>
          [v4(), new File([await file.arrayBuffer()], file.name, { type: file.type })] as const,
      ),
    ),
  )
