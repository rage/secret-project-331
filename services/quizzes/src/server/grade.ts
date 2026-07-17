import { assessAnswers } from "@/grading/assessment"
import { submissionFeedback } from "@/grading/feedback"
import { gradeAnswers } from "@/grading/grading"
import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import type { GradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import {
  migratePrivateSpecToLatest,
  migrateUserAnswerToLatest,
} from "@/util/migration/migrateToLatest"
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

  // Migrate to newer version (spec first, then the answer against the migrated spec)
  const privateSpecQuiz = migratePrivateSpecToLatest(exercise_spec)
  const userAnswer =
    migrateUserAnswerToLatest(submission_data, privateSpecQuiz) ?? (submission_data as UserAnswer)

  // Generate feedbacks
  const assessedAnswers = assessAnswers(userAnswer, privateSpecQuiz)
  const score = gradeAnswers(assessedAnswers, privateSpecQuiz)
  const scoreMaximum = privateSpecQuiz.items.length
  const overallCorrectnessRatio = scoreMaximum > 0 ? score / scoreMaximum : 1
  const feedbacks: ItemAnswerFeedback[] = submissionFeedback(
    userAnswer,
    privateSpecQuiz,
    assessedAnswers,
    overallCorrectnessRatio,
  )

  const responseJson: ExerciseTaskGradingResult = {
    feedback_json: feedbacks,
    feedback_text: null,
    grading_progress: "FullyGraded",
    score_given: score,
    score_maximum: scoreMaximum,
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
