import { v4 } from "uuid"

import { testRuns } from "./testRuns"

import { reportErrorOccurrence } from "@/shared-module/common/errors/reportErrorOccurrence"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { RunResult } from "@/tmc/cli"
import { badRequest, jsonOk } from "@/util/apiResponse"
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

function reportBackgroundFailure(err: unknown, request: Request): void {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : null
  void reportErrorOccurrence(
    {
      service: "tmc",
      error_source: "backend",
      message,
      stack_trace: stack,
      details: { kind: "tmc-background-test-run" },
    },
    {
      requestContext: {
        headers: request.headers,
        url: request.url,
      },
    },
  )
}

function isValidTestRequest(body: unknown): body is TestRequest {
  if (
    body === null ||
    typeof body !== "object" ||
    !("type" in body) ||
    !("templateDownloadUrl" in body)
  ) {
    return false
  }
  const b = body as TestRequest
  if (typeof b.templateDownloadUrl !== "string") {
    return false
  }
  if (b.type === "browser") {
    return (
      Array.isArray(b.files) &&
      b.files.every(
        (f): f is { filepath: string; contents: string } =>
          typeof f === "object" &&
          f !== null &&
          "filepath" in f &&
          "contents" in f &&
          typeof f.filepath === "string" &&
          typeof f.contents === "string",
      )
    )
  }
  if (b.type === "editor") {
    return typeof (b as { archiveDownloadUrl?: unknown }).archiveDownloadUrl === "string"
  }
  return false
}

async function postImpl(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  if (!isValidTestRequest(body)) {
    return badRequest("Invalid test request")
  }

  const testRunId = v4()
  testRuns.set(testRunId, null)
  const templateDownloadUrl = body.templateDownloadUrl
  const options =
    body.type === "browser"
      ? { type: "browser" as const, files: body.files }
      : { type: "editor" as const, archiveDownloadUrl: body.archiveDownloadUrl }

  runTests(templateDownloadUrl, options)
    .then((rr) => testRuns.set(testRunId, rr))
    .catch((err) => {
      testRuns.set(testRunId, errorRunResult(err))
      reportBackgroundFailure(err, req)
    })
  return jsonOk<TestRequestResult>({ id: testRunId })
}

export const POST = wrapRouteHandler(postImpl, { service: "tmc", operation: "POST /test" })
