import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, errorResponse, jsonOk } from "@/util/apiResponse"

import { gradingSandboxMode, REMOTE_TEST_RUNS_UNAVAILABLE } from "./remoteSandbox/config"
import { testRuns } from "./testRuns"

// oxlint-disable-next-line require-await -- async for the Promise route-handler contract
async function getImpl(req: Request): Promise<Response> {
  if (gradingSandboxMode() === "remote") {
    return errorResponse(501, REMOTE_TEST_RUNS_UNAVAILABLE)
  }
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
