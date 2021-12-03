import { NextApiRequest, NextApiResponse } from "next"

import { ModelSolutionQuiz, Quiz } from "../../../types/types"

interface QuizzesModelSolutionRes {
  modelSolution: ModelSolutionQuiz
}

export default (req: NextApiRequest, res: NextApiResponse<QuizzesModelSolutionRes>): void => {
  const quiz: Quiz = req.body

  const modelSolution = createModelSolution(quiz)

  return res.status(200).json({ modelSolution })
}

function createModelSolution(quiz: Quiz): ModelSolutionQuiz {
  const modelSolution: ModelSolutionQuiz = quiz

  return modelSolution
}
