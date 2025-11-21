import http from "http"

import { REDIRECT_URI } from "./constants"

let _redirectServer: http.Server | null = null

export async function setupRedirectServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const uri = new URL(REDIRECT_URI)
    _redirectServer = http.createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" })
      res.end("<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>")
    })
    _redirectServer.once("error", reject)
    _redirectServer.listen(Number(uri.port || 80), uri.hostname, () => resolve())
  })
}

export async function teardownRedirectServer(): Promise<void> {
  if (_redirectServer) {
    await new Promise<void>((resolve) => _redirectServer!.close(() => resolve()))
    _redirectServer = null
  }
}
