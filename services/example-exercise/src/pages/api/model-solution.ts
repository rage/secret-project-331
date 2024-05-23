/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import {
  ClientErrorResponse,
  ModelSolutionApi,
  PublicAlternative,
} from "../../util/stateInterfaces"

import { SpecRequest } from "@/shared-module/common/bindings"
import { isSpecRequest } from "@/shared-module/common/bindings.guard"

export default (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  try {
    if (!isSpecRequest(req.body)) {
      throw new Error("Request was not valid.")
    }
    return handlePost(req, res)
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

const handlePost = (
  req: NextApiRequest,
  res: NextApiResponse<ModelSolutionApi | ClientErrorResponse>,
) => {
  const specRequest = req.body as SpecRequest
  const uncheckedAlternatives: unknown = specRequest.private_spec
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
