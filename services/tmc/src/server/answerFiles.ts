import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"

import { answerFilesRequestSchema } from "./requestSchemas"

/**
 * Reports which files one of this service's answers consists of, for an answer whose files the host
 * does not already have.
 *
 * Always none: every tmc answer names host-stored uploads, so the host has the files before it
 * could ask. The endpoint stays only as long as this service declares it.
 */
async function postImpl(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  if (!answerFilesRequestSchema.safeParse(body).success) {
    return badRequest("Request was not valid.")
  }
  return jsonOk({ files: [] })
}

export const handleAnswerFiles = wrapRouteHandler(postImpl, {
  service: "tmc",
  operation: "POST /api/answer-files",
})
