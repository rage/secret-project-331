import { BadRequestError, jsonRoute, readJsonBody } from "@/lib/apiRoutes"
import type {
  GradingRequest,
  GradingResult,
} from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types-2"
import { isNonGenericGradingRequest } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types.guard"
import { migrateAnswerToLatest, migratePrivateSpecToLatest } from "@/util/migration/migrateToLatest"
import { MalformedBlobError } from "@/util/migration/versions"
import { toVersionedFeedback, type VersionedExerciseFeedback } from "@/util/stateInterfaces"

type ExampleExerciseGradingResult = GradingResult<VersionedExerciseFeedback | null>

// The host never retries a non-2xx grade: a first submission rolls back and a regrade is stored as
// failed. So a stored blob no migration can read is answered with `Failed`, not an error status.
const UNGRADEABLE: ExampleExerciseGradingResult = {
  grading_progress: "Failed",
  score_given: 0,
  score_maximum: 1,
  feedback_text: null,
  feedback_json: null,
}

// `exercise_spec` is the stored private spec and `submission_data` the stored answer; regrades replay
// old blobs, so both are migrated on read.
function grade(gradingRequest: GradingRequest<unknown, unknown>): ExampleExerciseGradingResult {
  const alternatives = migratePrivateSpecToLatest(gradingRequest.exercise_spec)
  const { selectedOptionId } = migrateAnswerToLatest(gradingRequest.submission_data)
  if (!selectedOptionId) {
    return {
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "You didn't select anything",
      feedback_json: null,
    }
  }

  const selectedOption = alternatives.find((option) => option.id === selectedOptionId)
  if (!selectedOption || !selectedOption.correct) {
    return {
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "Your answer was not correct",
      feedback_json: toVersionedFeedback(false),
    }
  }

  return {
    grading_progress: "FullyGraded",
    score_given: 1,
    score_maximum: 1,
    feedback_text: "Good job!",
    feedback_json: toVersionedFeedback(true),
  }
}

export const handleGrade = jsonRoute(async (request) => {
  const body = await readJsonBody(request)
  if (!isNonGenericGradingRequest(body)) {
    throw new BadRequestError("Invalid grading request")
  }
  try {
    return Response.json(grade(body as GradingRequest<unknown, unknown>))
  } catch (error) {
    if (!(error instanceof MalformedBlobError)) {
      throw error
    }
    console.warn(`Ungradeable submission: ${error.message}`)
    return Response.json(UNGRADEABLE)
  }
})
