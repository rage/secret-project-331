/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import { Quiz } from "../../../types/types"
import { SpecRequest } from "../../shared-module/bindings"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "../../util/migration/modelSolutionSpecQuiz"

export default (req: NextApiRequest, res: NextApiResponse<ModelSolutionQuiz>): void => {
  const specRequest = req.body as SpecRequest
  const quiz = specRequest.private_spec as Quiz | null
  if (quiz === null) {
    throw "Private spec cannot be null"
  }

  const modelSolution = createModelSolution(quiz)
  return res.status(200).json(modelSolution)
}

function createModelSolution(quiz: Quiz | ModelSolutionQuiz): ModelSolutionQuiz {
  let modelSolution: ModelSolutionQuiz | null = null
  if (isOldQuiz(quiz)) {
    modelSolution = migrateModelSolutionSpecQuiz(quiz as Quiz)
  } else {
    modelSolution = quiz as ModelSolutionQuiz
  }

  return modelSolution as ModelSolutionQuiz
}
