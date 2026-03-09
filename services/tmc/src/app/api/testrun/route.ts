import { NextRequest } from "next/server"

import { testRuns } from "../test/testRuns"

import { badRequest, jsonOk } from "@/util/apiResponse"

export async function GET(req: NextRequest): Promise<Response> {
  const id = req.nextUrl.searchParams.get("id")

  if (typeof id === "string") {
    return jsonOk(testRuns.get(id) ?? null)
  } else {
    return badRequest("Invalid query")
  }
}
