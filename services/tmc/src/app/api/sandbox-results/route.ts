import { NextResponse } from "next/server"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"

/** Returns 404 for unsupported sandbox-results route. */
function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

const SERVICE = "tmc"

export const GET = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "GET /sandbox-results",
})
export const POST = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "POST /sandbox-results",
})
export const PUT = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "PUT /sandbox-results",
})
export const PATCH = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "PATCH /sandbox-results",
})
export const DELETE = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "DELETE /sandbox-results",
})
export const OPTIONS = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "OPTIONS /sandbox-results",
})
export const HEAD = wrapRouteHandler(notFound, {
  service: SERVICE,
  operation: "HEAD /sandbox-results",
})
