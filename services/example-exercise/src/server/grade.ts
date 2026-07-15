import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import {
  GradingRequest,
  GradingResult,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import {
  alternativesFromStored,
  parseAnswer,
  toVersionedFeedback,
  VersionedExerciseFeedback,
} from "@/util/stateInterfaces"

type ExampleExerciseGradingResult = GradingResult<VersionedExerciseFeedback | null>

// `exercise_spec` is the stored private spec and `submission_data` the stored answer, either of
// which may arrive in a legacy or versioned shape (regrades replay old blobs) — migrate both on read.
function grade(gradingRequest: GradingRequest<unknown, unknown>): Response {
  const selectedOptionId = parseAnswer(gradingRequest.submission_data).selectedOptionId
  if (!selectedOptionId) {
    return Response.json({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "You didn't select anything",
      feedback_json: null,
    } satisfies ExampleExerciseGradingResult)
  }

  const alternatives = alternativesFromStored(gradingRequest.exercise_spec) ?? []
  const selectedOption = alternatives.find((option) => option.id === selectedOptionId)
  if (!selectedOption || !selectedOption.correct) {
    return Response.json({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "Your answer was not correct",
      feedback_json: toVersionedFeedback(false),
    } satisfies ExampleExerciseGradingResult)
  }

  return Response.json({
    grading_progress: "FullyGraded",
    score_given: 1,
    score_maximum: 1,
    feedback_text: "Good job!",
    feedback_json: toVersionedFeedback(true),
  } satisfies ExampleExerciseGradingResult)
}

export const handleGrade = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isNonGenericGradingRequest(body)) {
    throw new BadRequestError("Invalid grading request")
  }
  return grade(body as GradingRequest<unknown, unknown>)
})
