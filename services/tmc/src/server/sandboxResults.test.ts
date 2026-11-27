// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { sendGradingUpdate } from "./gradingUpdate"
import type { SandboxTokenPayload } from "./remoteSandbox/token"
import { sealToken } from "./remoteSandbox/token"
import { sandboxResultsHandlers } from "./sandboxResults"
import { handleTest } from "./testEndpoint"
import { handleTestrun } from "./testrun"

vi.mock("./gradingUpdate", () => ({ sendGradingUpdate: vi.fn(() => Promise.resolve(true)) }))
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock("./remoteSandbox/redisGradingStore", async () => {
  const { MemoryRemoteGradingStore } = await import("./remoteSandbox/gradingStore")
  return {
    connectRedis: () => null,
    RedisRemoteGradingStore: class extends MemoryRemoteGradingStore {
      public constructor() {
        super(Date.now)
      }
    },
  }
})

const KEY = Buffer.alloc(32, 3)

vi.stubEnv("TMC_GRADING_SANDBOX", "remote")
vi.stubEnv("TMC_REMOTE_SANDBOX_URLS", "http://127.0.0.1:9")
vi.stubEnv("TMC_REMOTE_SANDBOX_NOTIFY_URL", "http://localhost/api/sandbox-results")
vi.stubEnv("TMC_REMOTE_SANDBOX_TOKEN_KEY", KEY.toString("base64"))
vi.stubEnv("TMC_REMOTE_SANDBOX_REDIS_URL", "redis://127.0.0.1:9")

const passedBody = JSON.parse(
  readFileSync(
    join(import.meta.dirname, "../../tests/fixtures/sandbox-callbacks/finished-passed.json"),
    "utf8",
  ),
) as Record<string, unknown>

let nonceCounter = 0
function token(overrides: Partial<SandboxTokenPayload> = {}): string {
  nonceCounter++
  return sealToken(
    {
      v: 1,
      url: "http://lms/grading-update/s1",
      claim: "claim",
      points: ["1.passing_exercise"],
      nonce: `nonce-${nonceCounter.toString()}`,
      exp: Date.now() + 60_000,
      ...overrides,
    },
    KEY,
  )
}

function post(body: unknown): Promise<Response> {
  return sandboxResultsHandlers.POST(
    new Request("http://localhost/api/sandbox-results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.mocked(sendGradingUpdate).mockClear()
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("POST /api/sandbox-results in remote mode", () => {
  it("answers 200 and reports the grading", async () => {
    const res = await post({ ...passedBody, token: token() })
    expect(res.status).toBe(200)
    expect(sendGradingUpdate).toHaveBeenCalledWith(
      "http://lms/grading-update/s1",
      "claim",
      expect.objectContaining({ grading_progress: "FullyGraded", score_given: 1 }),
    )
  })

  it("answers 200 to a repeated callback without reporting it again", async () => {
    const body = { ...passedBody, token: token() }
    await post(body)
    const res = await post(body)
    expect(res.status).toBe(200)
    expect(sendGradingUpdate).toHaveBeenCalledTimes(1)
  })

  it("rejects a tampered token with 401", async () => {
    const sealed = token()
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("AA") ? "BB" : "AA"}`
    const res = await post({ ...passedBody, token: tampered })
    expect(res.status).toBe(401)
    expect(sendGradingUpdate).not.toHaveBeenCalled()
  })

  it("rejects an expired token with 401", async () => {
    const res = await post({ ...passedBody, token: token({ exp: Date.now() - 1 }) })
    expect(res.status).toBe(401)
  })

  it("rejects a body that is not a sandbox result with 400", async () => {
    expect((await post("not json")).status).toBe(400)
    expect((await post({ token: token(), status: "exploded" })).status).toBe(400)
  })
})

describe("test runs in remote mode", () => {
  it("are not available", async () => {
    const test = await handleTest(
      new Request("http://localhost/api/test", { method: "POST", body: "{}" }),
    )
    expect(test.status).toBe(501)
    const testrun = await handleTestrun(new Request("http://localhost/api/testrun?id=x"))
    expect(testrun.status).toBe(501)
  })
})
