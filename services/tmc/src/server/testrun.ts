import { testRuns } from "./testRuns"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"

// oxlint-disable-next-line require-await -- async for the Promise route-handler contract
async function getImpl(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id")

  if (typeof id === "string") {
    return jsonOk(testRuns.get(id))
  }
  return badRequest("Invalid query")
}

export const handleTestrun = wrapRouteHandler(getImpl, {
  service: "tmc",
  operation: "GET /testrun",
})
