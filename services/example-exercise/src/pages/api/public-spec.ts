/* eslint-disable i18next/no-literal-string */
import { NextApiRequest, NextApiResponse } from "next"

import { SpecRequest } from "../../shared-module/bindings"
import { isSpecRequest } from "../../shared-module/bindings.guard"
import { Alternative, ClientErrorResponse, PublicAlternative } from "../../util/stateInterfaces"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "POST") {
    return res.status(404).json({ message: "Not found" })
  }

  try {
    if (!isSpecRequest(req.body)) {
      throw new Error("Request was not valid.")
    }
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

function handlePost(
  req: NextApiRequest,
  res: NextApiResponse<PublicAlternative[] | ClientErrorResponse>,
) {
  const specRequest = req.body as SpecRequest
  const uncheckedAlternatives: unknown = specRequest.private_spec
  if (!Array.isArray(uncheckedAlternatives)) {
    return res
      .status(400)
      .json({ message: "Malformed data:" + JSON.stringify(uncheckedAlternatives) })
  }

  const publicAlternatives = uncheckedAlternatives.map<PublicAlternative>((x: Alternative) => ({
    id: x.id,
    name: x.name,
  }))
  return res.status(200).json(publicAlternatives)
}
