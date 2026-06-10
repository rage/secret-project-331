import { NextResponse } from "next/server"

import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import {
  GradingRequest,
  GradingResult,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import { Alternative, Answer, ExerciseFeedback } from "@/util/stateInterfaces"

type ExampleExerciseGradingResult = GradingResult<ExerciseFeedback | null>
type ServiceGradingRequest = GradingRequest<Alternative[], Answer>

function grade(gradingRequest: ServiceGradingRequest): NextResponse<ExampleExerciseGradingResult> {
  const selectedOptionId = gradingRequest.submission_data?.selectedOptionId
  if (!selectedOptionId) {
    return NextResponse.json<ExampleExerciseGradingResult>({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "You didn't select anything",
      feedback_json: null,
    })
  }

  const selectedOption = gradingRequest.exercise_spec.find(
    (option) => option.id === selectedOptionId,
  )
  if (!selectedOption || !selectedOption.correct) {
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

export const POST = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isNonGenericGradingRequest(body)) {
    throw new BadRequestError("Invalid grading request")
  }
  return grade(body as ServiceGradingRequest)
})
