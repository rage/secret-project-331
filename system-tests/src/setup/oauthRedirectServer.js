/**
 * Standalone OAuth redirect server (plain Node so globalSetup can spawn without ts-node).
 * Must match REDIRECT_URI in utils/oauth/constants.ts (127.0.0.1:8765).
 */
const http = require("http")
const HOST = "127.0.0.1"
const PORT = 8765

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" })
  res.end("<!doctype html><title>OAuth Callback</title><h1>Callback OK</h1>")
})

server.listen(PORT, HOST, () => {
  // Process stays alive while server is listening
})
