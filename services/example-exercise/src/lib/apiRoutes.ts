import { NextResponse } from "next/server"

import { reportErrorOccurrence } from "@/shared-module/common/errors/reportErrorOccurrence"
import type { ClientErrorResponse } from "@/util/stateInterfaces"

const SERVICE_NAME = "example-exercise"

/**
 * Thrown by route handlers when the request is malformed. {@link jsonRoute} turns it into a `400`
 * response with the message as JSON.
 */
export class BadRequestError extends Error {}

/**
 * Parses the request body as JSON, throwing {@link BadRequestError} when the `Content-Type` is not
 * `application/json`, the body is empty, or the body is not valid JSON.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    throw new BadRequestError("Content-Type must be application/json")
  }
  const bodyText = await request.text()
  if (!bodyText || bodyText.trim() === "") {
    throw new BadRequestError("Request body is empty")
  }
  try {
    return JSON.parse(bodyText)
  } catch {
    throw new BadRequestError("Invalid JSON in request body")
  }
}

function pathnameOf(url: string): string | null {
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

/**
 * Wraps a route handler so {@link BadRequestError}s become `400` responses and any other error a
 * `500`, both as JSON. This lets the handlers focus on the happy path and keeps error responses
 * consistent across endpoints. Unexpected errors are reported to the monitoring backend before the
 * `500` is returned.
 *
 * Unimplemented HTTP methods do not need handlers: Next.js responds with `405 Method Not Allowed`
 * automatically for any verb a route does not export.
 */
export function jsonRoute(
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      if (error instanceof BadRequestError) {
        return NextResponse.json<ClientErrorResponse>({ message: error.message }, { status: 400 })
      }
      console.error("Unhandled error in route handler:", error)
      void reportErrorOccurrence(
        {
          service: SERVICE_NAME,
          error_source: "backend",
          message: error instanceof Error ? error.message : String(error),
          stack_trace: error instanceof Error ? (error.stack ?? null) : null,
          path: pathnameOf(request.url),
          details: {
            kind: "next-route-handler",
            method: request.method,
            url: request.url,
          },
        },
        { requestContext: { headers: request.headers, url: request.url } },
      )
      return NextResponse.json<ClientErrorResponse>(
        { message: "Internal server error" },
        { status: 500 },
      )
    }
  }
}
