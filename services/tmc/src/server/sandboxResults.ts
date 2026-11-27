import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, errorResponse, jsonOk } from "@/util/apiResponse"
import { createLogger } from "@/util/logger"

import { outcomeFromCallback, sandboxCallbackSchema } from "./remoteSandbox/callback"
import { gradingSandboxMode, remoteSandboxConfig } from "./remoteSandbox/config"
import { remoteGradings } from "./remoteSandbox/remoteGradings"
import { openToken } from "./remoteSandbox/token"

const logger = createLogger("sandbox-results")

/**
 * `test_output` and `vm_log` grow with the student's output and the sandbox does not cap them.
 * Parsing holds a few copies of the body, within the service's 300Mi memory limit.
 */
const MAX_CALLBACK_BYTES = 16 * 1024 * 1024

function notFound() {
  return Response.json({ message: "Not found" }, { status: 404 })
}

/** The sandbox's notify callback. Answers before reporting the grading: the sandbox gives up after 30 s and never retries. */
async function postImpl(request: Request): Promise<Response> {
  if (gradingSandboxMode() !== "remote") {
    return notFound()
  }
  const body = await readCappedText(request, MAX_CALLBACK_BYTES)
  if (body === null) {
    return errorResponse(413, "Sandbox result too large")
  }
  let json: unknown
  try {
    json = JSON.parse(body)
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = sandboxCallbackSchema.safeParse(json)
  if (!parsed.success) {
    return badRequest("Invalid sandbox result")
  }
  const payload = openToken(parsed.data.token, remoteSandboxConfig().tokenKeys, Date.now())
  if (!payload) {
    logger.log("Rejected a sandbox result with an invalid or expired token")
    return Response.json({ message: "Invalid token" }, { status: 401 })
  }
  if (!remoteGradings.handleCallback(payload, outcomeFromCallback(parsed.data, logger))) {
    logger.log("Ignored a repeated sandbox result")
  }
  return jsonOk({ message: "ok" })
}

/** The body as text, or null when it is longer than `maxBytes`. */
async function readCappedText(request: Request, maxBytes: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    return null
  }
  if (!request.body) {
    return ""
  }
  const chunks: Uint8Array[] = []
  let length = 0
  for await (const chunk of request.body) {
    length += chunk.length
    if (length > maxBytes) {
      return null
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
}

const SERVICE = "tmc"

const wrap = (method: string) =>
  wrapRouteHandler(notFound, { service: SERVICE, operation: `${method} /sandbox-results` })

/** One wrapped handler per method, mounted in the route's server handlers. */
export const sandboxResultsHandlers = {
  GET: wrap("GET"),
  POST: wrapRouteHandler(postImpl, { service: SERVICE, operation: "POST /sandbox-results" }),
  PUT: wrap("PUT"),
  PATCH: wrap("PATCH"),
  DELETE: wrap("DELETE"),
  OPTIONS: wrap("OPTIONS"),
  HEAD: wrap("HEAD"),
}
