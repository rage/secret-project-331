import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"

import { buildUserAnswerRequestSchema } from "./requestSchemas"

/**
 * Accepts the archive a native client uploaded as this service's answer. The answer itself is null:
 * a tmc answer is its archive and carries no metadata, so the uploaded file is the whole answer.
 *
 * Still rejects anything but exactly one archive, which is what a tmc answer consists of.
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
  if (files.length !== 1) {
    return badRequest(
      `A tmc answer needs exactly one uploaded archive, got ${files.length.toString()}`,
    )
  }
  return jsonOk({ answer: null })
}

export const handleBuildUserAnswer = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /api/build-user-answer",
})
