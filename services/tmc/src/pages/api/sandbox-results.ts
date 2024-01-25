/* eslint-disable i18next/no-literal-string */
import axios from "axios"
import type { NextApiRequest, NextApiResponse } from "next"

import { ClientErrorResponse, ExerciseFeedback } from "../../lib"
import { GradingResult } from "../../shared-module/common/exercise-service-protocol-types-2"

// Endpoint for the sandbox to report test results
export default async (
  req: NextApiRequest,
  res: NextApiResponse<void | ClientErrorResponse>,
): Promise<void> => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  // verify that the request is coming from sandbox?
  return await handlePost(req, res)
}

interface TestResults {
  success: boolean
  score_given: number
  score_maximum: number
  stdout: string
  stderr: string
}

const handlePost = async (req: NextApiRequest, res: NextApiResponse<void>): Promise<void> => {
  // guard
  const testResults: TestResults = req.body

  // test results to grading result
  const grading: GradingResult<ExerciseFeedback> = {
    grading_progress: "FullyGraded",
    score_given: testResults.score_given,
    score_maximum: testResults.score_maximum,
    feedback_text: null,
    feedback_json: { stdout: testResults.stdout, stderr: testResults.stderr },
  }

  // send grading to lms
  await axios.post("lms/something", grading)

  return res.status(200).send()
}
