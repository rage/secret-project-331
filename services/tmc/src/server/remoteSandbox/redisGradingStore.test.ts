// @vitest-environment node
import { createServer } from "node:net"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it, vi } from "vitest"

import { connectRedis } from "./redisGradingStore"

/** A local port nothing listens on. */
async function closedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address() as AddressInfo
  await new Promise((resolve) => {
    server.close(resolve)
  })
  return port
}

describe("connectRedis", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("fails commands at once and logs the outage once while Redis is unreachable", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const client = connectRedis(`redis://127.0.0.1:${(await closedPort()).toString()}/13`)
    try {
      await vi.waitFor(() => {
        expect(error).toHaveBeenCalled()
      })
      for (let i = 0; i < 5; i++) {
        const startedAt = Date.now()
        await expect(client.get("key")).rejects.toThrow()
        expect(Date.now() - startedAt).toBeLessThan(1000)
        await new Promise((resolve) => {
          setTimeout(resolve, 200)
        })
      }
      expect(error).toHaveBeenCalledTimes(1)
    } finally {
      client.disconnect()
    }
  })
})
