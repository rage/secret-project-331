import { MalformedBlobError } from "@/util/migration/versions"
import type { ClientErrorResponse } from "@/util/stateInterfaces"

/**
 * Every error body this service sends. The host copies a non-2xx body into its own error messages
 * and logs, so bodies never carry detail; the detail goes to this service's log.
 */
export const ERROR_MESSAGES = {
  badRequest: "Bad request",
  tooLarge: "Request too large",
  internal: "Internal server error",
} as const

/**
 * Largest body a spec or grading request may have. Each carries a private spec and an answer, and
 * the host accepts at most 2 MiB of JSON for either.
 */
export const MAX_REQUEST_BYTES = 8 * 1024 * 1024

/** Largest CSV export body: the host sends up to 1000 stored answers or specs per request. */
export const MAX_EXPORT_REQUEST_BYTES = 64 * 1024 * 1024

/**
 * Thrown by route handlers when the request is malformed. {@link jsonRoute} answers it with `400`
 * and logs the message.
 */
export class BadRequestError extends Error {}

/** Thrown by {@link readJsonBody} for a body over its byte cap; answered with `413`. */
export class RequestTooLargeError extends Error {}

/**
 * Parses the request body as JSON of at most `maxBytes`, counted as it streams in. Throws
 * {@link BadRequestError} for a wrong `Content-Type`, an empty body or invalid JSON, and
 * {@link RequestTooLargeError} past the cap.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_REQUEST_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new BadRequestError("Content-Type must be application/json")
  }
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) {
    throw new RequestTooLargeError(`Declared body over ${maxBytes} bytes`)
  }
  const chunks: Uint8Array[] = []
  let received = 0
  if (request.body) {
    const reader = request.body.getReader()
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      received += chunk.value.byteLength
      if (received > maxBytes) {
        await reader.cancel()
        throw new RequestTooLargeError(`Body over ${maxBytes} bytes`)
      }
      chunks.push(chunk.value)
    }
  }
  const bodyText = new TextDecoder().decode(Buffer.concat(chunks))
  if (bodyText.trim() === "") {
    throw new BadRequestError("Request body is empty")
  }
  try {
    return JSON.parse(bodyText)
  } catch {
    throw new BadRequestError("Invalid JSON in request body")
  }
}

const errorResponse = (status: number, message: string): Response =>
  Response.json({ message } satisfies ClientErrorResponse, { status })

/**
 * Wraps a route handler so thrown errors become JSON responses with a body from
 * {@link ERROR_MESSAGES}: {@link BadRequestError} and {@link MalformedBlobError} `400`,
 * {@link RequestTooLargeError} `413`, anything else `500`.
 *
 * Unlike Next.js, TanStack Start doesn't auto-respond 405 for undeclared verbs — they fall through
 * to the app router. The backend only ever calls the documented verb, so this is fine.
 */
export function jsonRoute(
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      const route = `${request.method} ${new URL(request.url).pathname}`
      if (error instanceof BadRequestError || error instanceof MalformedBlobError) {
        console.warn(`${route}: ${error.message}`)
        return errorResponse(400, ERROR_MESSAGES.badRequest)
      }
      if (error instanceof RequestTooLargeError) {
        console.warn(`${route}: ${error.message}`)
        return errorResponse(413, ERROR_MESSAGES.tooLarge)
      }
      console.error(`${route}: unhandled error`, error)
      return errorResponse(500, ERROR_MESSAGES.internal)
    }
  }
}
