import { NextResponse } from "next/server"

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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!isNonGenericGradingRequest(body)) {
      throw new Error("Invalid grading request")
    }
    return handlePost(body as ServiceGradingRequest)
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
