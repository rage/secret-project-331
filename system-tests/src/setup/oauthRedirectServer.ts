/**
 * Standalone OAuth redirect server process. Started by globalSetup so all
 * Playwright workers share one server on 127.0.0.1:8765 (workers are separate
 * processes; only one can bind the port, so we run the server in this process).
 */
import http from "http"

import { REDIRECT_URI } from "../utils/oauth/constants"

const uri = new URL(REDIRECT_URI)
const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" })
  res.end("<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>")
})

server.listen(Number(uri.port || 80), uri.hostname, () => {
  // Process stays alive while server is listening
})
