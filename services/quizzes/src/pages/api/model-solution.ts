import { NextApiRequest, NextApiResponse } from "next"

import { ModelSolutionQuiz, Quiz } from "../../../types/types"

export default (req: NextApiRequest, res: NextApiResponse<ModelSolutionQuiz>): void => {
  const quiz: Quiz = req.body

  const modelSolution = createModelSolution(quiz)

  return res.status(200).json(modelSolution)
}

function createModelSolution(quiz: Quiz): ModelSolutionQuiz {
  const modelSolution: ModelSolutionQuiz = quiz

  // Let's never leak validity regex to students because it makes it too easy to figure out how to "trick" the check.
  modelSolution.items.forEach((item) => {
    // @ts-ignore: the field is there because of the cast above
    delete item.validityRegex
  })

  return modelSolution
}
