import { NextApiRequest, NextApiResponse } from "next"

import { ModelSolutionQuiz, Quiz } from "../../../types/types"

export default (req: NextApiRequest, res: NextApiResponse<ModelSolutionQuiz>): void => {
  const quiz: Quiz = req.body

  const modelSolution = createModelSolution(quiz)

  return res.status(200).json(modelSolution)
}

function createModelSolution(quiz: Quiz): ModelSolutionQuiz {
  const modelSolution: ModelSolutionQuiz = quiz

  return modelSolution
}
