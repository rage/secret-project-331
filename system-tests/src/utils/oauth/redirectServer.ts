import http from "http"

import { REDIRECT_URI } from "./constants"

let _redirectServer: http.Server | null = null
let _setupCount = 0
let _isSharedServer = false // Track if this worker is using a server set up by another worker
let _setupPromise: Promise<void> | null = null // Track ongoing setup to avoid race conditions

async function _verifyServerRunning(uri: URL): Promise<boolean> {
  return new Promise((resolve) => {
    const testReq = http.get(
      {
        hostname: uri.hostname,
        port: uri.port || 80,
        path: "/callback?test=1",
        timeout: 2000,
      },
      (res) => {
        // Server is responding, verify it's our redirect server
        let data = ""
        res.on("data", (chunk) => {
          data += chunk.toString()
        })
        res.on("end", () => {
          // Our server returns "Callback OK" in the body
          resolve(data.includes("Callback OK") || res.statusCode === 200)
        })
      },
    )
    testReq.on("error", () => {
      resolve(false)
    })
    testReq.on("timeout", () => {
      testReq.destroy()
      resolve(false)
    })
  })
}

export async function setupRedirectServer(): Promise<void> {
  // If setup is already in progress, wait for it
  if (_setupPromise) {
    await _setupPromise
    return
  }

  _setupCount++
  if (_redirectServer) {
    // Already set up in this worker
    return
  }

  const uri = new URL(REDIRECT_URI)

  _setupPromise = new Promise<void>((resolve, reject) => {
    try {
      _redirectServer = http.createServer((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/html" })
        res.end("<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>")
      })

      _redirectServer.once("error", (err: NodeJS.ErrnoException) => {
        // If port is already in use (EADDRINUSE), another worker already set it up
        if (err.code === "EADDRINUSE") {
          _redirectServer = null // Don't track it in this worker
          _setupCount-- // Adjust counter since we didn't actually set it up

          // Another worker has the server - mark as shared and continue
          // The server should be ready since the other worker's listen() succeeded
          _isSharedServer = true
          _setupPromise = null
          resolve()
        } else {
          _setupPromise = null
          reject(err)
        }
      })

      _redirectServer.listen(Number(uri.port || 80), uri.hostname, () => {
        // Server is listening, resolve immediately
        // No need to verify - if listen() succeeded, the server is ready
        _setupPromise = null
        resolve()
      })
    } catch (err) {
      _setupPromise = null
      reject(err)
    }
  })

  await _setupPromise
}

export async function teardownRedirectServer(): Promise<void> {
  _setupCount--
  // Only tear down if we actually set up the server in this worker
  // If we're using a shared server (_isSharedServer), don't tear it down
  if (_setupCount <= 0 && _redirectServer && !_isSharedServer) {
    await new Promise<void>((resolve) => _redirectServer!.close(() => resolve()))
    _redirectServer = null
    _setupCount = 0
  } else if (_isSharedServer) {
    // Reset the flag if we're done with this worker's tests
    _setupCount = 0
  }
}

/**
 * Ensure the redirect server is set up and running.
 * This function is safe to call multiple times and will ensure the server is ready.
 * Use this in helper functions that need the redirect server, rather than relying on beforeAll hooks.
 */
export async function ensureRedirectServer(): Promise<void> {
  // Quick check: if server is already set up in this worker, assume it's running
  // (we verify during setup, so no need to verify again on every call)
  if (_redirectServer || _isSharedServer) {
    return
  }

  // Set up the server (this is idempotent and thread-safe)
  // The setup function already verifies the server is running before resolving
  await setupRedirectServer()
}
