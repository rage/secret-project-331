/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import {
  ClientErrorResponse,
  ModelSolutionApi,
  PublicAlternative,
} from "../../util/stateInterfaces"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  return handlePost(req, res)
}

const handlePost = (
  req: NextApiRequest,
  res: NextApiResponse<ModelSolutionApi | ClientErrorResponse>,
) => {
  const uncheckedAlternatives: unknown = req.body
  if (!Array.isArray(uncheckedAlternatives)) {
    return res
      .status(400)
      .json({ message: "Malformed data:" + JSON.stringify(uncheckedAlternatives) })
  }

  const correctAlternatives: ModelSolutionApi = {
    correctOptionIds: uncheckedAlternatives
      .filter((alt) => Boolean(alt.correct))
      .map<string>((x: PublicAlternative) => x.id),
  }

  return res.status(200).json(correctAlternatives)
}
