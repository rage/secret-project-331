/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from "next"

import { hasAgentValidatorSecret } from "@/blockValidator/authorization"
import { stopBlockValidator } from "@/blockValidator/validatorWorker"
import blockSchemas from "@/pages/api/agent/block-schemas"
import health from "@/pages/api/agent/health"
import validateBlocks from "@/pages/api/agent/validate-blocks"

const SECRET = "test-secret"

interface RecordedResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

const call = async (
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
  method: string,
  authorization?: string,
): Promise<RecordedResponse> => {
  const recorded: RecordedResponse = { status: 0, headers: {}, body: undefined }
  const res = {
    setHeader: (name: string, value: string) => {
      recorded.headers[name] = value
      return res
    },
    status: (status: number) => {
      recorded.status = status
      return res
    },
    json: (body: unknown) => {
      recorded.body = body
      return res
    },
  }
  const req = {
    method,
    headers: authorization === undefined ? {} : { authorization },
    body: { pages: [] },
  }
  await handler(req as unknown as NextApiRequest, res as unknown as NextApiResponse)
  return recorded
}

beforeAll(() => {
  process.env.AGENT_VALIDATOR_SECRET = SECRET
  process.env.BLOCK_VALIDATOR_WORKER_PATH = "/nonexistent/block-validator-worker.cjs"
})
afterAll(stopBlockValidator)

describe("agent validator secret", () => {
  it.each([
    [`Bearer ${SECRET}`, SECRET, true],
    [`Bearer ${SECRET}x`, SECRET, false],
    [SECRET, SECRET, false],
    [undefined, SECRET, false],
    ["Bearer ", "", false],
    ["Bearer anything", undefined, false],
  ])("%s against %s: %s", (header, secret, expected) => {
    expect(hasAgentValidatorSecret(header, secret)).toBe(expected)
  })
})

describe("agent validator routes", () => {
  it.each([
    ["validate-blocks", validateBlocks, "POST"],
    ["block-schemas", blockSchemas, "GET"],
    ["health", health, "GET"],
  ] as const)("%s refuses requests without the secret", async (_name, handler, method) => {
    for (const authorization of [undefined, "Bearer wrong"]) {
      const response = await call(handler, method, authorization)
      expect(response.status).toBe(401)
      expect(response.headers["WWW-Authenticate"]).toBe("Bearer")
    }
  })

  it("checks the method after the secret", async () => {
    expect((await call(validateBlocks, "GET")).status).toBe(401)
    const response = await call(validateBlocks, "GET", `Bearer ${SECRET}`)
    expect(response.status).toBe(405)
    expect(response.headers.Allow).toBe("POST")
  })

  it("answers 503 while the validator isn't running", async () => {
    for (const [handler, method] of [
      [validateBlocks, "POST"],
      [blockSchemas, "GET"],
      [health, "GET"],
    ] as const) {
      const response = await call(handler, method, `Bearer ${SECRET}`)
      expect(response.status).toBe(503)
      expect(response.headers["Retry-After"]).toBe("1")
    }
  })
})
