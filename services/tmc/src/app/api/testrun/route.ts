import { NextRequest } from "next/server"

import { testRuns } from "../test/testRuns"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { badRequest, jsonOk } from "@/util/apiResponse"

async function getImpl(req: NextRequest): Promise<Response> {
  const id = req.nextUrl.searchParams.get("id")

  if (typeof id === "string") {
    return jsonOk(testRuns.get(id))
  } else {
    return badRequest("Invalid query")
  }
}

export const GET = wrapRouteHandler(getImpl, { service: "tmc", operation: "GET /testrun" })
