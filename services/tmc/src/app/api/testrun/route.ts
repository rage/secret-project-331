import { NextRequest, NextResponse } from "next/server"

import { testRuns } from "../test/route"

import { ClientErrorResponse } from "@/lib"
import { RunResult } from "@/tmc/cli"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = req.nextUrl.searchParams.get("id")

  if (typeof id === "string") {
    return ok(testRuns.get(id) ?? null)
  } else {
    return badRequest("Invalid query")
  }
}

export async function POST(): Promise<NextResponse> {
  return badRequest("Wrong method")
}

export async function PUT(): Promise<NextResponse> {
  return badRequest("Wrong method")
}

export async function DELETE(): Promise<NextResponse> {
  return badRequest("Wrong method")
}

export async function PATCH(): Promise<NextResponse> {
  return badRequest("Wrong method")
}

export async function HEAD(): Promise<NextResponse> {
  return badRequest("Wrong method")
}

export async function OPTIONS(): Promise<NextResponse> {
  return badRequest("Wrong method")
}

// response helpers

const ok = (runResult: RunResult | null): NextResponse => {
  return NextResponse.json<RunResult | null>(runResult, { status: 200 })
}

const badRequest = (contextMessage: string, error?: unknown): NextResponse => {
  return errorResponse(400, contextMessage, error)
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
  console.error(`[testrun]`, message, ...optionalParams)
}
