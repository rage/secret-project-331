import type http from "http"

import { createHttpServer } from "./createHttpServer"

const BASE_PORT = 8765
const PORT_COUNT = 20

interface ServerContext {
  setupCount: number
  setupPromise: Promise<void> | null
  server: http.Server | null
  html: string
  port: number | null
}

export async function setupServer(serverContext: ServerContext): Promise<void> {
  if (serverContext.setupPromise) {
    await serverContext.setupPromise
    return
  }

  serverContext.setupCount++
  if (serverContext.server) {
    return
  }

  serverContext.setupPromise = new Promise<void>((resolve, reject) => {
    const server = createHttpServer(serverContext.html)

    function tryPort(port: number) {
      if (port > BASE_PORT + PORT_COUNT - 1) {
        serverContext.setupPromise = null
        reject(new Error("No free port in range 8765..8784"))
        return
      }
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          tryPort(port + 1)
        } else {
          serverContext.setupPromise = null
          reject(err)
        }
      })

      server.listen(port, "127.0.0.1", () => {
        serverContext.server = server
        serverContext.port = port
        serverContext.setupPromise = null
        resolve()
      })
    }

    tryPort(BASE_PORT)
  })

  await serverContext.setupPromise
}

// oxlint-disable-next-line require-await -- async for the Promise<void> public API; callers await it
export async function teardownServer(setupCount: number): Promise<void> {
  setupCount--
  if (setupCount <= 0) {
    setupCount = 0
    // Do not close the server; process exit cleans up. Avoids races with in-flight redirects.
  }
}
