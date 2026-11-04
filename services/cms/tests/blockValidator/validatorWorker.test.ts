/**
 * @jest-environment node
 */

import path from "path"

import {
  callBlockValidator,
  startBlockValidator,
  stopBlockValidator,
} from "@/blockValidator/validatorWorker"

import { waitUntilReady } from "./runValidator"

const call = (body: Record<string, unknown>) => callBlockValidator({ kind: "validate", body })

beforeAll(async () => {
  process.env.BLOCK_VALIDATOR_WORKER_PATH = path.join(
    import.meta.dirname,
    "fixtures",
    "scriptedWorker.cjs",
  )
  startBlockValidator({ requestDeadlineMs: 600, processingTimeoutMs: 500, workerHeapLimitMb: 32 })
  await waitUntilReady()
})
afterAll(stopBlockValidator)

describe("validator worker scheduling", () => {
  it("answers requests past their deadline with 503 and keeps a busy but healthy worker", async () => {
    const first = call({ busy_ms: 380 })
    const second = call({ busy_ms: 380 })
    const third = call({ n: 3 })
    expect(await first).toEqual({ status: 200, body: { busy_ms: 380 } })
    expect((await second).status).toBe(503)
    expect(await third).toEqual({ status: 503, body: { error: "The block validator is busy." } })
    // A replaced worker would still be restarting past this request's deadline.
    expect(await call({ n: 4 })).toEqual({ status: 200, body: { n: 4 } })
  })

  it("answers a margin before the caller's own timeout", async () => {
    await waitUntilReady()
    const busy = call({ busy_ms: 380 })
    // Would wait out the busy request under the 600 ms default; 1.2 s less the margin is 200 ms.
    const queued = callBlockValidator({ kind: "validate", body: { n: 7 } }, 1_200)
    expect((await queued).status).toBe(503)
    expect((await busy).status).toBe(200)
  })

  it("answers a request the worker is stuck on with 413 and serves the next from a new worker", async () => {
    expect((await call({ busy_ms: 2_000 })).status).toBe(413)
    await waitUntilReady()
    expect(await call({ n: 5 })).toEqual({ status: 200, body: { n: 5 } })
  })

  it("answers a request that exhausts the worker's memory with 413", async () => {
    await waitUntilReady()
    expect((await call({ exhaust_memory: true })).status).toBe(413)
    await waitUntilReady()
    expect(await call({ n: 6 })).toEqual({ status: 200, body: { n: 6 } })
  })
})
