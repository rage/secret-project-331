import { randomUUID } from "crypto"
import * as nodeFs from "fs"

import FormData from "form-data"

import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"

const ARCHIVE_UPLOAD_TIMEOUT_MS = 10 * 60 * 1000

/** One archive as the host stored it. */
export interface UploadedArchive {
  /** `file_uploads.id`, which a spec names to declare the file. */
  id: string
  url: string
}

interface UploadArchiveOptions {
  archivePath: string
  archiveName: string
  uploadUrl: string
  uploadClaim: string | null
}

/**
 * Upload one archive and return the host's id for the stored file and its non-empty download URL.
 *
 * The multipart field name has to be a UUID unique within the request — the host validates that and
 * then discards it. It is not the id that comes back: the response carries the host's own
 * `file_uploads` id, which is what a spec must name to declare the file as still in use.
 */
export async function uploadArchive({
  archivePath,
  archiveName,
  uploadUrl,
  uploadClaim,
}: UploadArchiveOptions): Promise<UploadedArchive> {
  const uploadId = randomUUID()
  const form = new FormData()
  form.append(uploadId, nodeFs.createReadStream(archivePath), archiveName)
  const headers: Record<string, string> = {}
  if (uploadClaim) {
    headers[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER] = uploadClaim
  }
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { ...headers, ...form.getHeaders() },
    body: form as unknown as Exclude<RequestInit["body"], undefined>,
    signal: AbortSignal.timeout(ARCHIVE_UPLOAD_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
  }
  const resData: unknown = await res.json()
  if (Array.isArray(resData) && resData.length === 1) {
    const entry: unknown = resData[0]
    if (
      typeof entry === "object" &&
      entry !== null &&
      "id" in entry &&
      typeof entry.id === "string" &&
      entry.id.length > 0 &&
      "url" in entry &&
      typeof entry.url === "string" &&
      entry.url.length > 0
    ) {
      return { id: entry.id, url: entry.url }
    }
  }
  throw new Error(`Unexpected upload response for "${archiveName}" — ${JSON.stringify(resData)}`)
}
