/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { OldQuiz } from "../../../types/oldQuizTypes"
import { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import { isSpecRequest } from "../../shared-module/bindings.guard"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "../../util/migration/modelSolutionSpecQuiz"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  try {
    return handleModelSolutionGeneration(req, res)
  } catch (e) {
    console.error("Model solution request failed:", e)
    if (e instanceof Error) {
      return res.status(500).json({
        error_name: e.name,
        error_message: e.message,
        error_stack: e.stack,
      })
    }
  }
}

function handleModelSolutionGeneration(
  req: NextApiRequest,
  res: NextApiResponse<ModelSolutionQuiz>,
) {
  if (!isSpecRequest(req.body)) {
    throw new Error("Request was not valid.")
  }
  const specRequest = req.body
  const quiz = specRequest.private_spec as OldQuiz | null
  if (quiz === null) {
    throw "Private spec cannot be null"
  }

  const modelSolution = createModelSolution(quiz)
  return res.status(200).json(modelSolution)
}

function createModelSolution(quiz: OldQuiz | ModelSolutionQuiz): ModelSolutionQuiz {
  let modelSolution: ModelSolutionQuiz | null = null
  if (isOldQuiz(quiz)) {
    modelSolution = migrateModelSolutionSpecQuiz(quiz as OldQuiz)
  } else {
    modelSolution = quiz as ModelSolutionQuiz
  }

  return modelSolution as ModelSolutionQuiz
}
