import { NextResponse } from "next/server"

import { UserAnswer } from "../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../types/quizTypes/grading"
import { PrivateSpecQuiz } from "../../../../types/quizTypes/privateSpec"
import { assessAnswers } from "../../../grading/assessment"
import { submissionFeedback } from "../../../grading/feedback"
import { gradeAnswers } from "../../../grading/grading"
import { handlePrivateSpecMigration, handleUserAnswerMigration } from "../../../grading/utils"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import { GradingRequest } from "@/shared-module/common/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/common/exercise-service-protocol-types.guard"
import { ExerciseTaskGradingResult } from "@/utils/exerciseServiceApi"

type QuizzesGradingRequest = GradingRequest<PrivateSpecQuiz, UserAnswer>

function handleGradingRequest(body: unknown): ExerciseTaskGradingResult {
  // Validate grading request
  if (!isNonGenericGradingRequest(body)) {
    throw new Error("Invalid grading request")
  }
  const { exercise_spec, submission_data } = body as QuizzesGradingRequest

  // Migrate to newer version
  const privateSpecQuiz = handlePrivateSpecMigration(exercise_spec)
  const userAnswer = handleUserAnswerMigration(privateSpecQuiz, submission_data)

  // Generate feedbacks
  const assessedAnswers = assessAnswers(userAnswer, privateSpecQuiz)
  const score = gradeAnswers(assessedAnswers, privateSpecQuiz)
  const feedbacks: ItemAnswerFeedback[] = submissionFeedback(
    submission_data,
    exercise_spec,
    assessedAnswers,
    exercise_spec.submitMessage,
  )

  const responseJson: ExerciseTaskGradingResult = {
    feedback_json: feedbacks,
    feedback_text: null,
    grading_progress: "FullyGraded",
    score_given: score,
    score_maximum: exercise_spec.items.length,
  }

  return responseJson
}

/**
 * Handle grading requests
 */
const SERVICE = "quizzes"

async function postImpl(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 })
  }
  try {
    const result = handleGradingRequest(body)
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error_message: message }, { status: 500 })
  }
}

function notFound() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export const POST = wrapRouteHandler(postImpl, { service: SERVICE, operation: "POST /grade" })
export const GET = wrapRouteHandler(notFound, { service: SERVICE, operation: "GET /grade" })
export const PUT = wrapRouteHandler(notFound, { service: SERVICE, operation: "PUT /grade" })
export const PATCH = wrapRouteHandler(notFound, { service: SERVICE, operation: "PATCH /grade" })
export const DELETE = wrapRouteHandler(notFound, { service: SERVICE, operation: "DELETE /grade" })
export const OPTIONS = wrapRouteHandler(notFound, { service: SERVICE, operation: "OPTIONS /grade" })
function headNotFound() {
  return new Response(null, { status: 404 })
}

export const HEAD = wrapRouteHandler(headNotFound, {
  service: SERVICE,
  operation: "HEAD /grade",
})
