/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from "next"

import {
  GradingRequest,
  GradingResult,
} from "../../shared-module/exercise-service-protocol-types-2"
import { Alternative, Answer, ClientErrorResponse } from "../../util/stateInterfaces"

export default (
  req: NextApiRequest,
  res: NextApiResponse<ExampleExerciseGradingResult | ClientErrorResponse>,
): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return handlePost(req, res)
}

type ExampleExerciseGradingResult = GradingResult<ExerciseFeedback | null>

export interface ExerciseFeedback {
  selectedOptionIsCorrect: boolean
}

type ServiceGradingRequest = GradingRequest<Alternative[], Answer>

const handlePost = (req: NextApiRequest, res: NextApiResponse<ExampleExerciseGradingResult>) => {
  const gradingRequest: ServiceGradingRequest = req.body

  if (!gradingRequest?.submission_data?.selectedOptionId) {
    return res.status(200).json({
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
    return res.status(200).json({
      grading_progress: "FullyGraded",
      score_given: 0,
      score_maximum: 1,
      feedback_text: "Your answer was not correct",
      feedback_json: { selectedOptionIsCorrect: false },
    })
  }

  res.status(200).json({
    grading_progress: "FullyGraded",
    score_given: 1,
    score_maximum: 1,
    feedback_text: "Good job!",
    feedback_json: { selectedOptionIsCorrect: true },
  })
}
