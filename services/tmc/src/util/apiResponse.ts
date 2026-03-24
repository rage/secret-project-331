import { ClientErrorResponse } from "@/lib"

export function jsonOk<T>(data: T): Response {
  return Response.json(data, { status: 200 })
}

export function errorResponse(statusCode: number, contextMessage: string, err?: unknown): Response {
  let message: string
  let stack: string | undefined = undefined
  if (err instanceof Error) {
    message = `${contextMessage}: ${err.message}`
    stack = err.stack
  } else if (typeof err === "string") {
    message = `${contextMessage}: ${err}`
  } else if (err === undefined) {
    message = contextMessage
  } else {
    message = `${contextMessage}: ${JSON.stringify(err, undefined, 2)}`
  }
  console.error(message, stack)
  const bodyMessage = statusCode >= 500 ? contextMessage : message
  const body: ClientErrorResponse = { message: bodyMessage }
  return Response.json(body, { status: statusCode })
}

export function badRequest(contextMessage: string, err?: unknown): Response {
  return errorResponse(400, contextMessage, err)
}

export function internalServerError(contextMessage: string, err?: unknown): Response {
  return errorResponse(500, contextMessage, err)
}
