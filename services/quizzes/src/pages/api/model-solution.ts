/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { ModelSolutionQuiz, Quiz } from "../../../types/types"
import { SpecRequest } from "../../shared-module/bindings"

export default (req: NextApiRequest, res: NextApiResponse<ModelSolutionQuiz>): void => {
  const specRequest = req.body as SpecRequest
  const quiz = specRequest.private_spec as Quiz | null
  if (quiz === null) {
    throw "Private spec cannot be null"
  }

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
