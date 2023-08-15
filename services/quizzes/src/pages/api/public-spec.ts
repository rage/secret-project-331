/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import { Quiz } from "../../../types/types"
import { isSpecRequest } from "../../shared-module/bindings.guard"
import { convertPublicSpecFromPrivateSpec } from "../../util/converter"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "../../util/migration/privateSpecQuiz"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  try {
    return handlePost(req, res)
  } catch (e) {
    console.error("Public spec request failed:", e)
    if (e instanceof Error) {
      return res.status(500).json({
        error_name: e.name,
        error_message: e.message,
        error_stack: e.stack,
      })
    }
  }
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
  if (isSpecRequest(req.body)) {
    throw new Error("Invalid request")
  }
  const specRequest = req.body
  const quiz = specRequest.private_spec as Quiz | PrivateSpecQuiz | null
  if (quiz === null) {
    throw "Quiz cannot be null"
  }
  let converted: PrivateSpecQuiz | null = null
  if (isOldQuiz(quiz)) {
    converted = migratePrivateSpecQuiz(quiz as Quiz)
  } else {
    converted = quiz as PrivateSpecQuiz
  }
  const publicSpecQuiz = convertPublicSpecFromPrivateSpec(converted)
  return res.status(200).json(publicSpecQuiz)
}
