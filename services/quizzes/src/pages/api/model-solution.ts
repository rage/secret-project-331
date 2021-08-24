import { NextApiRequest, NextApiResponse } from "next"

export default (_req: NextApiRequest, res: NextApiResponse): void => {
  return res.status(200).json({ model_solution: {} })
}
