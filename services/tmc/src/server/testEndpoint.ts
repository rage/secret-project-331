import { v4 } from "uuid"

import { testRequestSchema } from "./requestSchemas"
import { testRuns } from "./testRuns"

import { reportErrorOccurrence } from "@/shared-module/common/errors/reportErrorOccurrence"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import type { RunResult } from "@/tmc/cli"
import { badRequest, jsonOk } from "@/util/apiResponse"
import { runTests } from "@/util/test"

export type { TestRequest } from "./requestSchemas"

export interface TestRequestResult {
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
  let path: string | null
  try {
    path = new URL(request.url).pathname
  } catch {
    path = null
  }
  void reportErrorOccurrence(
    {
      service: "tmc",
      error_source: "backend",
      message,
      stack_trace: stack ?? null,
      path,
      details: {
        kind: "tmc-background-test-run",
        operation: "tmc.background-test-run",
        method: request.method,
        url: path,
      },
    },
    {
      requestContext: {
        headers: request.headers,
        url: request.url,
      },
    },
  )
}

async function postImpl(req: Request): Promise<Response> {
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return badRequest("Invalid JSON payload")
  }
  const parsed = testRequestSchema.safeParse(rawBody)
  if (!parsed.success) {
    return badRequest("Invalid test request")
  }
  const body = parsed.data

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
    .catch((err) => {
      reportBackgroundFailure(err, req)
    })
  return jsonOk<TestRequestResult>({ id: testRunId })
}

export const handleTest = wrapRouteHandler(postImpl, { service: "tmc", operation: "POST /test" })
