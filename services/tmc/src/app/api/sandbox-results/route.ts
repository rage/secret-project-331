import axios from "axios"
import { NextResponse } from "next/server"

import { ClientErrorResponse, ExerciseFeedback } from "@/lib"
import { GradingResult } from "@/shared-module/common/exercise-service-protocol-types-2"

// Endpoint for the sandbox to report test results

interface TestResults {
  success: boolean
  score_given: number
  score_maximum: number
  stdout: string
  stderr: string
}

const notFound = (): NextResponse => {
  return NextResponse.json({ message: "Not found" } as ClientErrorResponse, { status: 404 })
}

const handlePost = async (request: Request): Promise<Response> => {
  // guard
  const testResults: TestResults = await request.json()

  // test results to grading result
  const grading: GradingResult<ExerciseFeedback> = {
    grading_progress: "FullyGraded",
    score_given: testResults.score_given,
    score_maximum: testResults.score_maximum,
    feedback_text: null,
    feedback_json: { stdout: testResults.stdout, stderr: testResults.stderr },
  }

  // send grading to lms
  await axios.post("lms/something", grading)

  return new Response(null, { status: 200 })
}

export async function POST(request: Request): Promise<Response> {
  // verify that the request is coming from sandbox?
  return await handlePost(request)
}

export function GET(): NextResponse {
  return notFound()
}

export function PUT(): NextResponse {
  return notFound()
}

export function PATCH(): NextResponse {
  return notFound()
}

export function DELETE(): NextResponse {
  return notFound()
}

export function HEAD(): NextResponse {
  return notFound()
}

export function OPTIONS(): NextResponse {
  return notFound()
}
