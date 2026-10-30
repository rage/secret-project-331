import type { NextApiRequest, NextApiResponse } from "next"

import { hasAgentValidatorSecret } from "./authorization"
import type { ValidatorResponse } from "./protocol"

/** How long the caller waits for the answer, from the `X-Client-Timeout-Ms` header headless-lms sends. */
const clientTimeoutMs = (req: NextApiRequest): number | undefined => {
  const timeout = Number(req.headers["x-client-timeout-ms"])
  return Number.isFinite(timeout) && timeout > 0 ? timeout : undefined
}

/**
 * Internal agent validator API route: checks the bearer secret, then the method. `respond` gets
 * the caller's timeout, if any.
 */
export const agentValidatorRoute =
  (
    method: "GET" | "POST",
    respond: (
      req: NextApiRequest,
      clientTimeoutMs: number | undefined,
    ) => Promise<ValidatorResponse>,
  ) =>
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
    const response = await respond(req, clientTimeoutMs(req))
    if (response.status === 503) {
      res.setHeader("Retry-After", "1")
    }
    res.status(response.status).json(response.body)
  }
