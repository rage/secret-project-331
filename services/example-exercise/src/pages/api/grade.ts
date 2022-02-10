/* eslint-disable i18next/no-literal-string */
import type { NextApiRequest, NextApiResponse } from "next"

import { Alternative, Answer, ClientErrorResponse } from "../../util/stateInterfaces"

export default (
  req: NextApiRequest,
  res: NextApiResponse<GradingResult | ClientErrorResponse>,
): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return handlePost(req, res)
}

interface GradingResult {
  grading_progress: "FullyGraded" | "Pending" | "PendingManual" | "Failed"
  score_given: number
  score_maximum: number
  feedback_text: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  feedback_json: ExerciseFeedback | null
}

export interface ExerciseFeedback {
  selectedOptionIsCorrect: boolean
}

interface GradingRequest {
  exercise_spec: Alternative[]
  submission_data: Answer
}

const handlePost = (req: NextApiRequest, res: NextApiResponse<GradingResult>) => {
  const gradingRequest: GradingRequest = req.body

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
