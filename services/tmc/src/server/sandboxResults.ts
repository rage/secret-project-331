import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"

/** Returns 404 for unsupported sandbox-results route. */
function notFound() {
  return Response.json({ message: "Not found" }, { status: 404 })
}

const SERVICE = "tmc"

const wrap = (method: string) =>
  wrapRouteHandler(notFound, { service: SERVICE, operation: `${method} /sandbox-results` })

/** One wrapped 404 handler per method, mounted in the route's server handlers. */
export const sandboxResultsHandlers = {
  GET: wrap("GET"),
  POST: wrap("POST"),
  PUT: wrap("PUT"),
  PATCH: wrap("PATCH"),
  DELETE: wrap("DELETE"),
  OPTIONS: wrap("OPTIONS"),
  HEAD: wrap("HEAD"),
}
