import { NextResponse } from "next/server"

import { UserAnswer } from "../../../../types/quizTypes/answer"
import { ItemAnswerFeedback } from "../../../../types/quizTypes/grading"
import { PrivateSpecQuiz } from "../../../../types/quizTypes/privateSpec"
import { assessAnswers } from "../../../grading/assessment"
import { submissionFeedback } from "../../../grading/feedback"
import { gradeAnswers } from "../../../grading/grading"
import { handlePrivateSpecMigration, handleUserAnswerMigration } from "../../../grading/utils"

import { ExerciseTaskGradingResult } from "@/shared-module/common/bindings"
import { GradingRequest } from "@/shared-module/common/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/common/exercise-service-protocol-types.guard"

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
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const result = handleGradingRequest(body)
    return NextResponse.json(result, { status: 200 })
  } catch (e) {
    console.error("Grading request failed:", e)
    if (e instanceof Error) {
      return NextResponse.json(
        {
          error_name: e.name,
          error_message: e.message,
          error_stack: e.stack,
        },
        { status: 500 },
      )
    }
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function PUT() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function PATCH() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function DELETE() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function OPTIONS() {
  return NextResponse.json({ message: "Not found" }, { status: 404 })
}

export async function HEAD() {
  return new Response(null, { status: 404 })
}
