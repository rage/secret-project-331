import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"
import type { EditorUserAnswer } from "@/util/stateInterfaces"

import { buildUserAnswerRequestSchema } from "./requestSchemas"

/**
 * Turns files the host stored for a native client into this service's editor answer — the same
 * shape the in-browser iframe builds from an `upload-result` message, so the two paths produce
 * identical answers.
 */
async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = buildUserAnswerRequestSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest("Request was not valid.")
  }

  const files = parsed.data.uploaded_files
  const file = files[0]
  if (files.length !== 1 || !file) {
    return badRequest(
      `An editor answer needs exactly one uploaded archive, got ${files.length.toString()}`,
    )
  }
  const answer: EditorUserAnswer = {
    type: "editor",
    archive_file_id: file.id,
    archive_download_url: file.url,
  }
  return jsonOk({ answer })
}

export const handleBuildUserAnswer = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /api/build-user-answer",
})
