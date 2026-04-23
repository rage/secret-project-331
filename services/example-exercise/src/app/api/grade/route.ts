import { NextResponse } from "next/server"

import { wrapRouteHandler } from "@/shared-module/common/errors/wrapRouteHandler"
import {
  GradingRequest,
  GradingResult,
} from "@/shared-module/common/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/common/exercise-service-protocol-types.guard"
import { Alternative, Answer } from "@/util/stateInterfaces"

type ExampleExerciseGradingResult = GradingResult<ExerciseFeedback | null>

export interface ExerciseFeedback {
  selectedOptionIsCorrect: boolean
}

type ServiceGradingRequest = GradingRequest<Alternative[], Answer>

async function postImpl(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON in request body" }, { status: 400 })
  }
  if (!isNonGenericGradingRequest(body)) {
    return NextResponse.json({ message: "Invalid grading request" }, { status: 400 })
  }
  return handlePost(body as ServiceGradingRequest)
}

const handlePost = (gradingRequest: ServiceGradingRequest) => {
  if (!gradingRequest?.submission_data?.selectedOptionId) {
    return NextResponse.json<ExampleExerciseGradingResult>({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "You didn't select anything",
      feedback_json: null,
    })
  }

  const selectedOptionId = gradingRequest?.submission_data?.selectedOptionId

  const selectedOptionSpec = gradingRequest?.exercise_spec.find((o) => o.id == selectedOptionId)
  if (!selectedOptionSpec || !selectedOptionSpec.correct) {
    return NextResponse.json<ExampleExerciseGradingResult>({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "Your answer was not correct",
      feedback_json: { selectedOptionIsCorrect: false },
    })
  }

  return NextResponse.json<ExampleExerciseGradingResult>({
    grading_progress: "FullyGraded",
    score_given: 1,
    score_maximum: 1,
    feedback_text: "Good job!",
    feedback_json: { selectedOptionIsCorrect: true },
  })
}

export const POST = wrapRouteHandler(postImpl, {
  service: "example-exercise",
  operation: "POST /grade",
})
