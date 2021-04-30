import type { NextApiRequest, NextApiResponse } from "next"

export default (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(404)
  }

  return handlePost(req, res)
}

interface GradingResult {
  grading_progress: "FullyGraded | Pending | PendingManual | Failed"
  score_given: number
  score_maximum: number
  feedback_text: string
  feedback_obj: null
}

const handlePost = (req: NextApiRequest, res: NextApiResponse<GradingResult>) => {
  res.status(200).json({ name: "John Doe" })
}
