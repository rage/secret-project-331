// @vitest-environment node
import { createHmac } from "node:crypto"
import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import type { RemoteSandboxConfig, SandboxServer } from "./config"
import type { DispatchClock, SandboxTask } from "./dispatch"
import { dispatchToSandbox } from "./dispatch"

interface ReceivedTask {
  headers: IncomingMessage["headers"]
  form: FormData
}

interface Reply {
  status: number
  body: unknown
}

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve)
        }),
    ),
  )
  vi.restoreAllMocks()
})

/** A stand-in sandbox server that answers each POST with the next reply, the last one repeating. */
async function fakeSandbox(
  replies: Reply[],
): Promise<{ server: SandboxServer; received: ReceivedTask[] }> {
  const received: ReceivedTask[] = []
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      void new Response(Buffer.concat(chunks), {
        headers: { "content-type": req.headers["content-type"] ?? "" },
      })
        .formData()
        .then((form) => {
          received.push({ headers: req.headers, form })
          const reply = replies[Math.min(received.length - 1, replies.length - 1)] as Reply
          res.writeHead(reply.status, { "content-type": "application/json" })
          res.end(JSON.stringify(reply.body))
        })
    })
  })
  servers.push(server)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address() as AddressInfo
  return {
    server: { baseUrl: `http://127.0.0.1:${port.toString()}`, authorization: null },
    received,
  }
}

async function unreachableServer(): Promise<SandboxServer> {
  const server = createServer()
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address() as AddressInfo
  await new Promise((resolve) => {
    server.close(resolve)
  })
  return { baseUrl: `http://127.0.0.1:${port.toString()}`, authorization: null }
}

function config(
  sandboxes: SandboxServer[],
  notifySecret: string | null = null,
): RemoteSandboxConfig {
  return {
    servers: sandboxes,
    notifyUrl: "https://courses.mooc.fi/tmc/api/sandbox-results",
    notifySecret,
    tokenKeys: [Buffer.alloc(32)],
    redisUrl: "redis://localhost",
  }
}

/** Time advances only when the dispatcher sleeps; servers are tried in the configured order. */
function fakeClock(): DispatchClock & { sleeps: number[] } {
  let now = 0
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => now,
    sleep: (ms) => {
      sleeps.push(ms)
      now += ms
      return Promise.resolve()
    },
    shuffle: (items) => items,
  }
}

const TASK: SandboxTask = {
  archive: Buffer.from("zstd archive bytes"),
  image: "eu.gcr.io/moocfi-public/tmc-sandbox-python:latest",
  submissionId: "cmf-123",
  token: "sealed-token",
}

const ACCEPTED: Reply = { status: 200, body: { message: "ok" } }
const BUSY: Reply = {
  status: 503,
  body: { error: "Sandbox is currently busy, please try again later", statusCode: 503 },
}

describe("dispatchToSandbox", () => {
  it("sends the task as tmc-server does, with a zstd archive and a signed notify URL", async () => {
    const sandbox = await fakeSandbox([ACCEPTED])
    const result = await dispatchToSandbox(TASK, config([sandbox.server], "secret"), fakeClock())
    expect(result).toEqual({ accepted: true })
    const [received] = sandbox.received
    const form = received?.form as FormData
    expect(form.get("submission_id")).toBe("cmf-123")
    expect(form.get("docker_image")).toBe(TASK.image)
    expect(form.get("notify")).toBe("https://courses.mooc.fi/tmc/api/sandbox-results")
    expect(form.get("notify_signature")).toBe(
      createHmac("sha256", "secret")
        .update("https://courses.mooc.fi/tmc/api/sandbox-results")
        .digest("hex"),
    )
    expect(form.get("token")).toBe("sealed-token")
    expect(form.has("memory_limit_gb")).toBe(false)
    const file = form.get("file") as File
    expect(file.type).toBe("application/zstd")
    expect(file.name).toBe("submission.tar.zst")
    expect(Buffer.from(await file.arrayBuffer())).toEqual(TASK.archive)
  })

  it("omits the signature without a secret and sends configured credentials", async () => {
    const sandbox = await fakeSandbox([ACCEPTED])
    const server = { ...sandbox.server, authorization: "Basic dTpw" }
    await dispatchToSandbox(TASK, config([server]), fakeClock())
    expect(sandbox.received[0]?.form.has("notify_signature")).toBe(false)
    expect(sandbox.received[0]?.headers.authorization).toBe("Basic dTpw")
  })

  it.each<[string, Reply]>([
    ["503 busy", BUSY],
    ["master's 500 busy with a status", { status: 500, body: { status: "busy" } }],
    ["another 5xx", { status: 500, body: { error: "Internal server error", statusCode: 500 } }],
    ["429 too many requests", { status: 429, body: { error: "Too Many Requests" } }],
    ["401 bad credentials", { status: 401, body: { error: "Unauthorized" } }],
  ])("tries the next server after %s", async (_name, reply) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const first = await fakeSandbox([reply])
    const second = await fakeSandbox([ACCEPTED])
    const clock = fakeClock()
    expect(await dispatchToSandbox(TASK, config([first.server, second.server]), clock)).toEqual({
      accepted: true,
    })
    expect(first.received).toHaveLength(1)
    expect(second.received).toHaveLength(1)
    expect(clock.sleeps).toEqual([])
  })

  it("tries the next server when one is unreachable", async () => {
    const second = await fakeSandbox([ACCEPTED])
    const result = await dispatchToSandbox(
      TASK,
      config([await unreachableServer(), second.server]),
      fakeClock(),
    )
    expect(result).toEqual({ accepted: true })
  })

  it("waits 5 to 10 seconds and tries again when every server is busy", async () => {
    const sandbox = await fakeSandbox([BUSY, BUSY, ACCEPTED])
    const clock = fakeClock()
    expect(await dispatchToSandbox(TASK, config([sandbox.server]), clock)).toEqual({
      accepted: true,
    })
    expect(clock.sleeps).toHaveLength(2)
    for (const ms of clock.sleeps) {
      expect(ms).toBeGreaterThanOrEqual(5_000)
      expect(ms).toBeLessThanOrEqual(10_000)
    }
  })

  it("fails as busy once the servers have been busy for 15 minutes", async () => {
    const sandbox = await fakeSandbox([BUSY])
    const clock = fakeClock()
    const result = await dispatchToSandbox(TASK, config([sandbox.server]), clock)
    expect(result).toMatchObject({
      accepted: false,
      result: { grading_progress: "Failed", feedback_json: { feedback_key: "sandbox_busy" } },
    })
    expect(clock.now()).toBeLessThanOrEqual(15 * 60_000)
    expect(clock.now()).toBeGreaterThan(15 * 60_000 - 10_000)
  })

  it("fails as a server error when every server refuses the credentials", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const first = await fakeSandbox([{ status: 401, body: { error: "Unauthorized" } }])
    const second = await fakeSandbox([{ status: 404, body: { error: "Not Found" } }])
    const clock = fakeClock()
    expect(
      await dispatchToSandbox(TASK, config([first.server, second.server]), clock),
    ).toMatchObject({
      accepted: false,
      result: { feedback_json: { feedback_key: "server_error" } },
    })
    expect(clock.sleeps).toEqual([])
  })

  it("fails a submission the server finds too large", async () => {
    const sandbox = await fakeSandbox([
      { status: 413, body: { error: "request file too large", statusCode: 413 } },
    ])
    expect(await dispatchToSandbox(TASK, config([sandbox.server]), fakeClock())).toMatchObject({
      accepted: false,
      result: {
        grading_progress: "Failed",
        feedback_json: { feedback_key: "submission_too_large" },
      },
    })
  })

  it("fails as a server error on another 4xx, without trying other servers", async () => {
    const first = await fakeSandbox([
      { status: 400, body: { error: "Invalid notify URL signature", statusCode: 400 } },
    ])
    const second = await fakeSandbox([ACCEPTED])
    vi.spyOn(console, "error").mockImplementation(() => {})
    expect(
      await dispatchToSandbox(TASK, config([first.server, second.server]), fakeClock()),
    ).toMatchObject({
      accepted: false,
      result: { grading_progress: "Failed", feedback_json: { feedback_key: "server_error" } },
    })
    expect(second.received).toHaveLength(0)
  })

  it("does not take a 4xx with a status for busy", async () => {
    const sandbox = await fakeSandbox([{ status: 400, body: { status: "error" } }])
    vi.spyOn(console, "error").mockImplementation(() => {})
    const clock = fakeClock()
    expect(await dispatchToSandbox(TASK, config([sandbox.server]), clock)).toMatchObject({
      accepted: false,
      result: { feedback_json: { feedback_key: "server_error" } },
    })
    expect(clock.sleeps).toEqual([])
  })

  it("does not send an image the servers do not run", async () => {
    const sandbox = await fakeSandbox([ACCEPTED])
    vi.spyOn(console, "error").mockImplementation(() => {})
    const result = await dispatchToSandbox(
      { ...TASK, image: "docker.io/someone/custom:latest" },
      config([sandbox.server]),
      fakeClock(),
    )
    expect(result).toMatchObject({ accepted: false, result: { grading_progress: "Failed" } })
    expect(sandbox.received).toHaveLength(0)
  })
})
