import { assessAnswers } from "@/grading/assessment"
import { submissionFeedback } from "@/grading/feedback"
import { gradeAnswers } from "@/grading/grading"
import { handlePrivateSpecMigration, handleUserAnswerMigration } from "@/grading/utils"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import type { GradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import type { ExerciseTaskGradingResult } from "@/utils/exerciseServiceApi"

import type { UserAnswer } from "../../types/quizTypes/answer"
import type { ItemAnswerFeedback } from "../../types/quizTypes/grading"
import type { PrivateSpecQuiz } from "../../types/quizTypes/privateSpec"

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
    return Response.json({ message: "Invalid JSON in request body" }, { status: 400 })
  }
  try {
    const result = handleGradingRequest(body)
    return Response.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error_message: message }, { status: 500 })
  }
}

export const handleGrade = wrapRouteHandler(postImpl, {
  service: SERVICE,
  operation: "POST /grade",
})
