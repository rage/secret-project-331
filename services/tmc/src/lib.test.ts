// @vitest-environment node
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"

import { temporaryFile } from "tempy"
import { afterEach, describe, expect, it, vi } from "vitest"

import { downloadStream } from "./lib"

afterEach(() => {
  vi.restoreAllMocks()
})

describe("downloadStream", () => {
  it("gives up on a body that stalls past the deadline", async () => {
    vi.spyOn(console, "debug").mockImplementation(() => {})
    const server = createServer((_req, res) => {
      res.writeHead(200)
      res.write("partial")
    })
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve)
    })
    const { port } = server.address() as AddressInfo
    try {
      await expect(
        downloadStream(`http://127.0.0.1:${port.toString()}/`, temporaryFile(), 200),
      ).rejects.toThrow()
    } finally {
      server.closeAllConnections()
      server.close()
    }
  })
})
