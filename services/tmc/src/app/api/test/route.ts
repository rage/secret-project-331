import { v4 } from "uuid"

import { testRuns } from "./testRuns"

import { RunResult } from "@/tmc/cli"
import { badRequest, internalServerError, jsonOk } from "@/util/apiResponse"
import { ExerciseFile } from "@/util/stateInterfaces"
import { runTests } from "@/util/test"

export type TestRequest =
  | {
      type: "browser"
      templateDownloadUrl: string
      files: Array<ExerciseFile>
    }
  | {
      type: "editor"
      templateDownloadUrl: string
      archiveDownloadUrl: string
    }

export type TestRequestResult = {
  id: string
}

function errorRunResult(err: unknown): RunResult {
  return {
    status: "GENERIC_ERROR",
    testResults: [],
    logs: { error: err instanceof Error ? err.message : String(err) },
  }
}

function isValidTestRequest(body: unknown): body is TestRequest {
  return (
    body !== null &&
    typeof body === "object" &&
    "type" in body &&
    "templateDownloadUrl" in body &&
    ((body as TestRequest).type === "browser" || (body as TestRequest).type === "editor")
  )
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    if (!isValidTestRequest(body)) {
      return badRequest("Invalid test request")
    }

    const testRunId = v4()
    testRuns.set(testRunId, null)
    const templateDownloadUrl = body.templateDownloadUrl
    if (body.type === "browser") {
      runTests(templateDownloadUrl, {
        type: "browser",
        files: body.files,
      })
        .then((rr) => testRuns.set(testRunId, rr))
        .catch((err) => testRuns.set(testRunId, errorRunResult(err)))
      return jsonOk<TestRequestResult>({ id: testRunId })
    } else {
      runTests(templateDownloadUrl, {
        type: "editor",
        archiveDownloadUrl: body.archiveDownloadUrl,
      })
        .then((rr) => testRuns.set(testRunId, rr))
        .catch((err) => testRuns.set(testRunId, errorRunResult(err)))
      return jsonOk<TestRequestResult>({ id: testRunId })
    }
  } catch (err) {
    return internalServerError("Error while processing request", err)
  }
}
