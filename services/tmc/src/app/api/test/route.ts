import { NextResponse } from "next/server"
import { v4 } from "uuid"

import { testRuns } from "./testRuns"

import { ClientErrorResponse } from "@/lib"
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

export async function POST(req: Request): Promise<Response> {
  try {
    if (req.method !== "POST") {
      return badRequest("Wrong method")
    }

    const body = (await req.json()) as TestRequest

    const testRunId = v4()
    testRuns.set(testRunId, null)
    const templateDownloadUrl = body.templateDownloadUrl
    if (body.type === "browser") {
      runTests(templateDownloadUrl, {
        type: "browser",
        files: body.files,
      }).then((rr) => testRuns.set(testRunId, rr))
      return ok({ id: testRunId })
    } else if (body.type === "editor") {
      runTests(templateDownloadUrl, {
        type: "editor",
        archiveDownloadUrl: body.archiveDownloadUrl,
      }).then((rr) => testRuns.set(testRunId, rr))
      return ok({ id: testRunId })
    } else {
      throw new Error("Invalid type")
    }
  } catch (err) {
    return internalServerError("Error while processing request", err)
  }
}

// response helpers

const ok = (testRequestResult: TestRequestResult): NextResponse => {
  return NextResponse.json(testRequestResult, { status: 200 })
}

const badRequest = (contextMessage: string, error?: unknown): NextResponse => {
  return errorResponse(400, contextMessage, error)
}

const internalServerError = (contextMessage: string, err?: unknown): NextResponse => {
  return errorResponse(500, contextMessage, err)
}

const errorResponse = (statusCode: number, contextMessage: string, err?: unknown): NextResponse => {
  let message
  let stack = undefined
  if (err instanceof Error) {
    message = `${contextMessage}: ${err.message}`
    stack = err.stack
  } else if (typeof err === "string") {
    message = `${contextMessage}: ${err}`
  } else if (err === undefined) {
    message = contextMessage
  } else {
    // unexpected type
    message = `${contextMessage}: ${JSON.stringify(err, undefined, 2)}`
  }
  error(message, stack)
  return NextResponse.json<ClientErrorResponse>({ message }, { status: statusCode })
}

// logging helpers

const error = (message: string, ...optionalParams: unknown[]): void => {
  console.error(`[test]`, message, ...optionalParams)
}
