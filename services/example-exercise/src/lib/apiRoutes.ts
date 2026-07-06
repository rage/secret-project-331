import type { ClientErrorResponse } from "@/util/stateInterfaces"

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

/**
 * Wraps a route handler so {@link BadRequestError}s become `400` responses and any other error a
 * `500`, both as JSON. This lets the handlers focus on the happy path and keeps error responses
 * consistent across endpoints. Unexpected errors are logged before the `500` is returned.
 *
 * Note: unlike Next.js, TanStack Start does not auto-respond `405` for verbs a route does not
 * declare — an undeclared method falls through to the app router. The backend only ever calls the
 * documented verb per endpoint, so this is acceptable.
 */
export function jsonRoute(
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response> {
  return async (request) => {
    try {
      return await handler(request)
    } catch (error) {
      if (error instanceof BadRequestError) {
        return Response.json({ message: error.message } satisfies ClientErrorResponse, {
          status: 400,
        })
      }
      console.error("Unhandled error in route handler:", error)
      return Response.json({ message: "Internal server error" } satisfies ClientErrorResponse, {
        status: 500,
      })
    }
  }
}
