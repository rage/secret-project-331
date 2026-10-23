import type { NextApiRequest, NextApiResponse } from "next"

import { hasAgentValidatorSecret } from "./authorization"
import type { ValidatorResponse } from "./validatorWorker"

/** An internal agent validator API route: bearer secret first, then one HTTP method. */
export const agentValidatorRoute =
  (method: "GET" | "POST", respond: (req: NextApiRequest) => Promise<ValidatorResponse>) =>
  async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
    res.setHeader("Cache-Control", "no-store")
    if (!hasAgentValidatorSecret(req.headers.authorization)) {
      res.setHeader("WWW-Authenticate", "Bearer")
      res.status(401).json({ error: "Missing or wrong agent validator secret." })
      return
    }
    if (req.method !== method) {
      res.setHeader("Allow", method)
      res.status(405).json({ error: `Use ${method}.` })
      return
    }
    const response = await respond(req)
    if (response.status === 503) {
      res.setHeader("Retry-After", "1")
    }
    res.status(response.status).json(response.body)
  }
