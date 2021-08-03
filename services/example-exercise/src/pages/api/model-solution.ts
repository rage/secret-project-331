import { NextApiRequest, NextApiResponse } from "next"

import { ClientErrorResponse, PublicAlternative } from "../../util/stateInterfaces"

export default (req: NextApiRequest, res: NextApiResponse): void => {
  if (req.method !== "GET") {
    return res.status(404).json({ message: "Not found" })
  }

  return handleRequest(req, res)
}

const handleRequest = (
  req: NextApiRequest,
  res: NextApiResponse<PublicAlternative[] | ClientErrorResponse>,
) => {
  const uncheckedAlternatives: unknown = req.body
  if (!Array.isArray(uncheckedAlternatives)) {
    return res
      .status(400)
      .json({ message: "Malformed data:" + JSON.stringify(uncheckedAlternatives) })
  }

  const correctAlternatives = uncheckedAlternatives
    .filter((alt) => Boolean(alt.correct))
    .map<PublicAlternative>((x: PublicAlternative) => ({
      id: x.id,
      name: x.name,
    }))

  return res.status(200).json(correctAlternatives)
}
