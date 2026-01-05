import type { NextApiRequest, NextApiResponse } from "next"

export default (_req: NextApiRequest, res: NextApiResponse<boolean>): void => {
  res.status(200).json(true)
}
