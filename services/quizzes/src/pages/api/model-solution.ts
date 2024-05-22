/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { OldQuiz } from "../../../types/oldQuizTypes"
import { ModelSolutionQuiz } from "../../../types/quizTypes/modelSolutionSpec"
import { PrivateSpecQuizItemClosedEndedQuestion } from "../../../types/quizTypes/privateSpec"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import migrateModelSolutionSpecQuiz from "../../util/migration/modelSolutionSpecQuiz"

import { isSpecRequest } from "@/shared-module/common/bindings.guard"

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
    } else {
      return res.status(500).json({ error_message: e })
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
    throw new Error("Private spec cannot be null")
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
  if (modelSolution === null) {
    throw new Error("Model solution was null")
  }
  // Make sure we don't include illegal properties
  for (const quizItem of modelSolution.items) {
    if (quizItem.type === "closed-ended-question") {
      const asPrivateSpec = quizItem as PrivateSpecQuizItemClosedEndedQuestion
      if (asPrivateSpec.validityRegex !== undefined) {
        // @ts-expect-error: Deleting a property that should not exist
        delete asPrivateSpec.validityRegex
      }
    }
  }

  return modelSolution as ModelSolutionQuiz
}
