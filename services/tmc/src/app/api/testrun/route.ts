import { NextApiRequest, NextApiResponse } from "next"

import { testRuns } from "./test"

import { ClientErrorResponse } from "@/lib"
import { RunResult } from "@/tmc/cli"

export default async (
  req: NextApiRequest,
  res: NextApiResponse<(RunResult | null) | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "GET") {
    return badRequest(res, "Wrong method")
  }
  const id = req.query["id"]

  if (typeof id === "string") {
    ok(res, testRuns.get(id) ?? null)
  } else {
    badRequest(res, "Invalid query")
  }
}

// response helpers

const ok = (res: NextApiResponse<RunResult | null>, runResult: RunResult | null): void => {
  res.status(200).json(runResult)
}

const badRequest = (
  res: NextApiResponse<ClientErrorResponse>,
  contextMessage: string,
  error?: unknown,
): void => {
  errorResponse(res, 400, contextMessage, error)
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

const error = (message: string, ...optionalParams: unknown[]): void => {
  console.error(`[testrun]`, message, ...optionalParams)
}
