// A stand-in validator worker whose cost per request is set by the request body.
const { parentPort } = require("worker_threads")

parentPort.on("message", (request) => {
  const busyUntil = Date.now() + (request.body?.busy_ms ?? 0)
  while (Date.now() < busyUntil) {
    // Blocks the thread like a slow validation does.
  }
  if (request.body?.exhaust_memory) {
    const retained = []
    for (;;) {
      retained.push(Array.from({ length: 1_000_000 }, () => retained.length))
    }
  }
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not a window
  parentPort.postMessage({ id: request.id, status: 200, body: request.body })
})

// oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not a window
parentPort.postMessage({ kind: "ready" })
