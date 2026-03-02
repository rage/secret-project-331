import http from "http"

const REDIRECT_BASE_PORT = 8765
const REDIRECT_PORT_COUNT = 20

let _redirectServer: http.Server | null = null
let _boundPort: number | null = null
let _setupCount = 0
let _setupPromise: Promise<void> | null = null

/**
 * Redirect URI for this worker's callback server. Must be called after ensureRedirectServer().
 */
export function getRedirectUri(): string {
  if (_boundPort === null) {
    throw new Error("Redirect server not set up; call ensureRedirectServer() first")
  }
  return `http://127.0.0.1:${_boundPort}/callback`
}

export async function setupRedirectServer(): Promise<void> {
  if (_setupPromise) {
    await _setupPromise
    return
  }

  _setupCount++
  if (_redirectServer) {
    return
  }

  _setupPromise = new Promise<void>((resolve, reject) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end("<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>")
    })

    function tryPort(port: number) {
      if (port > REDIRECT_BASE_PORT + REDIRECT_PORT_COUNT - 1) {
        _setupPromise = null
        reject(new Error("No free port in OAuth redirect range 8765..8784"))
        return
      }
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          tryPort(port + 1)
        } else {
          _setupPromise = null
          reject(err)
        }
      })
      server.listen(port, "127.0.0.1", () => {
        _redirectServer = server
        _boundPort = port
        _setupPromise = null
        resolve()
      })
    }

    tryPort(REDIRECT_BASE_PORT)
  })

  await _setupPromise
}

export async function teardownRedirectServer(): Promise<void> {
  _setupCount--
  if (_setupCount <= 0) {
    _setupCount = 0
    // Do not close the server; process exit cleans up. Avoids races with in-flight redirects.
  }
}

/**
 * Ensure this worker has its own callback server (one port in 8765..8784 per worker).
 */
export async function ensureRedirectServer(): Promise<void> {
  if (_redirectServer) {
    return
  }
  await setupRedirectServer()
}
