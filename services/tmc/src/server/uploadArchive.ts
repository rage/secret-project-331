import { randomUUID } from "crypto"
import * as nodeFs from "fs"

import FormData from "form-data"

import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"

interface UploadArchiveOptions {
  archivePath: string
  archiveName: string
  uploadUrl: string
  uploadClaim: string | null
}

/** Upload one archive under a host-owned multipart UUID and return its non-empty download URL. */
export async function uploadArchiveAndGetUrl({
  archivePath,
  archiveName,
  uploadUrl,
  uploadClaim,
}: UploadArchiveOptions): Promise<string> {
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
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
  }
  const resData: unknown = await res.json()
  if (
    Array.isArray(resData) &&
    resData.length === 1 &&
    resData[0]?.id === uploadId &&
    typeof resData[0].url === "string" &&
    resData[0].url.length > 0
  ) {
    return resData[0].url
  }
  throw new Error(`Unexpected upload response for "${archiveName}" — ${JSON.stringify(resData)}`)
}
