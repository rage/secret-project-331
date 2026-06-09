import { NextResponse } from "next/server"

import type { ClientErrorResponse } from "@/util/stateInterfaces"

/**
 * Thrown by route handlers when the request is malformed. {@link jsonRoute} turns it into a `400`
 * response with the message as JSON.
 */
export class BadRequestError extends Error {}

/** Parses the request body as JSON, throwing {@link BadRequestError} when it is not valid JSON. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new BadRequestError("Invalid JSON in request body")
  }
}

/**
 * Wraps a route handler so {@link BadRequestError}s become `400` responses and any other error a
 * `500`, both as JSON. This lets the handlers focus on the happy path and keeps error responses
 * consistent across endpoints.
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
      return NextResponse.json<ClientErrorResponse>(
        { message: "Internal server error" },
        { status: 500 },
      )
    }
  }
}
