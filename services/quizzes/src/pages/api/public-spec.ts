/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { PrivateSpecQuiz } from "../../../types/quizTypes/privateSpec"
import { Quiz } from "../../../types/types"
import { SpecRequest } from "../../shared-module/bindings"
import { convertPublicSpecFromPrivateSpec } from "../../util/converter"
import { isOldQuiz } from "../../util/migration/migrationSettings"
import { migratePrivateSpecQuiz } from "../../util/migration/privateSpecQuiz"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return handlePost(req, res)
}

function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const specRequest = req.body as SpecRequest
  const quiz = specRequest.private_spec as Quiz | PrivateSpecQuiz | null
  if (quiz === null) {
    return res.status(502).json({
      message: "private spec cannot be null",
    })
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
