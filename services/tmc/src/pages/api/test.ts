import { NextApiRequest, NextApiResponse } from "next"
import { v4 } from "uuid"

import { ClientErrorResponse } from "@/lib"
import { RunResult } from "@/tmc/cli"
import { runTests } from "@/util/test"

// todo timed cache
export const testRuns: Map<string, RunResult | null> = new Map()

export type TestRequestResult = {
  id: string
}

export default async (
  req: NextApiRequest,
  res: NextApiResponse<TestRequestResult | ClientErrorResponse>,
): Promise<void> => {
  try {
    if (req.method !== "POST") {
      return badRequest(res, "Wrong method")
    }

    const testRunId = v4()
    testRuns.set(testRunId, null)
    const templateDownloadUrl = req.body.templateDownloadUrl
    if (req.body.type === "browser") {
      runTests(templateDownloadUrl, {
        type: "browser",
        files: req.body.files,
      }).then((rr) => testRuns.set(testRunId, rr))
      ok(res, { id: testRunId })
    } else if (req.body.type === "editor") {
      runTests(templateDownloadUrl, {
        type: "editor",
        archiveDownloadUrl: req.body.archiveDownloadUrl,
      }).then((rr) => testRuns.set(testRunId, rr))
      ok(res, { id: testRunId })
    }
  } catch (err) {
    return internalServerError(res, "Error while processing request", err)
  }
}

// response helpers

const ok = (
  res: NextApiResponse<TestRequestResult>,
  testRequestResult: TestRequestResult,
): void => {
  res.status(200).json(testRequestResult)
}

const badRequest = (
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  error?: unknown,
): void => {
  errorResponse(res, 400, contextMessage, error)
}

const internalServerError = (
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  err?: unknown,
): void => {
  errorResponse(res, 500, contextMessage, err)
}

const errorResponse = (
  res: NextApiResponse<ClientErrorResponse>,
  statusCode: number,
  contextMessage: string,
  err?: unknown,
) => {
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
  res.status(statusCode).json({ message })
}

// logging helpers

const log = (message: string, ...optionalParams: unknown[]): void => {
  console.log(`[test]`, message, ...optionalParams)
}

const debug = (message: string, ...optionalParams: unknown[]): void => {
  console.debug(`[test]`, message, ...optionalParams)
}

const error = (message: string, ...optionalParams: unknown[]): void => {
  console.error(`[test]`, message, ...optionalParams)
}
