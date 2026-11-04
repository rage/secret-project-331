// @vitest-environment node
import { createServer, request, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { setTimeout as sleep } from "node:timers/promises"

import { afterEach, describe, expect, it, vi } from "vitest"

import { drainOnSigterm } from "../../graceful-shutdown.mjs"

let server: Server

afterEach(() => {
  server?.closeAllConnections()
})

/** A server whose `/slow` answers after `slowMs`, listening on a free port. */
async function startServer(slowMs: number): Promise<string> {
  server = createServer((req, res) => {
    setTimeout(() => res.end("done"), req.url === "/slow" ? slowMs : 0)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const get = (url: string) =>
  new Promise<string>((resolve, reject) => {
    request(url, (res) => {
      let body = ""
      res.on("data", (chunk: Buffer) => (body += chunk.toString()))
      res.on("end", () => resolve(body))
    })
      .on("error", reject)
      .end()
  })

/** Stands in for `process`: `send()` delivers the SIGTERM. */
function fakeSignals() {
  let listener: (() => void) | null = null
  return {
    once: (_signal: string, handler: () => void) => {
      listener = handler
    },
    send: () => listener?.(),
  }
}

describe("drainOnSigterm", () => {
  it("finishes in-flight requests, refuses new ones, then exits 0", async () => {
    const origin = await startServer(300)
    const signals = fakeSignals()
    const exit = vi.fn()
    drainOnSigterm(server, { exit, signals, deadlineMs: 5_000 })

    const inFlight = get(`${origin}/slow`)
    await sleep(50)
    signals.send()
    await expect(get(`${origin}/fast`)).rejects.toThrow()
    expect(exit).not.toHaveBeenCalled()
    await expect(inFlight).resolves.toBe("done")
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0))
  })

  it("exits 1 at the deadline when a request hasn't finished", async () => {
    const origin = await startServer(10_000)
    const signals = fakeSignals()
    const exit = vi.fn()
    drainOnSigterm(server, { exit, signals, deadlineMs: 100 })

    void get(`${origin}/slow`).catch(() => {})
    await sleep(50)
    signals.send()
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1))
    expect(exit).toHaveBeenCalledTimes(1)
  })
})
