import { NextApiRequest, NextApiResponse } from "next"

import { ModelSolutionQuiz, Quiz } from "../../../types/types"

interface QuizzesModelSolutionReg {
  quiz: Quiz
}

interface QuizzesModelSolutionRes {
  modelSolution: ModelSolutionQuiz
}

export default (req: NextApiRequest, res: NextApiResponse<QuizzesModelSolutionRes>): void => {
  const { quiz }: QuizzesModelSolutionReg = req.body

  return res.status(200).json({ modelSolution: { ...quiz } })
}
