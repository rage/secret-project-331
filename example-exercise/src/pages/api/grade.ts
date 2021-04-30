import type { NextApiRequest, NextApiResponse } from "next"

export default (req: NextApiRequest, res: NextApiResponse): unknown => {
  if (req.method !== "POST") {
    return res.status(404)
  }

  return handlePost(req, res)
}

interface GradingResult {
  grading_progress: "FullyGraded" | "Pending" | "PendingManual" | "Failed"
  score_given: number
  score_maximum: number
  feedback_text: string
  feedback_obj: null
}

const handlePost = (_req: NextApiRequest, res: NextApiResponse<GradingResult>) => {
  res.status(200).json({
    grading_progress: "FullyGraded",
    score_given: 1,
    score_maximum: 1,
    feedback_text: "Good job!",
    feedback_obj: null,
  })
}
