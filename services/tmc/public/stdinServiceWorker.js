/**
 * Lets the Python worker read stdin synchronously in every browser: the worker blocks on a
 * synchronous XHR to `__stdin`, and this service worker answers it once the page posts the line.
 *
 * Protocol:
 * - `GET __stdin?probe` → 200 `ready`, so the worker can tell it is controlled.
 * - `GET __stdin?id=<id>` → 200 with the line posted for `id`, or 204 after HOLD_MS to make the
 *   worker ask again (browsers stop a service worker whose fetch stays open for minutes).
 * - message `{ type: "stdin_line", id, line }` from the page supplies the line.
 */
const HOLD_MS = 30_000

/** Lines that arrived before their request; ids are unique per input() call. */
const lines = new Map()
/** Requests waiting for their line. */
const waiting = new Map()

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  // Controls the already open editor, so its first Run can block on input.
  event.waitUntil(self.clients.claim())
})

self.addEventListener("message", (event) => {
  const { type, id, line } = event.data ?? {}
  if (type !== "stdin_line" || typeof id !== "string") {
    return
  }
  const resolve = waiting.get(id)
  if (resolve) {
    waiting.delete(id)
    resolve(String(line))
  } else {
    lines.set(id, String(line))
  }
})

function textResponse(status, body) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (!url.pathname.endsWith("/__stdin")) {
    return
  }
  if (url.searchParams.has("probe")) {
    event.respondWith(textResponse(200, "ready"))
    return
  }
  const id = url.searchParams.get("id")
  if (id === null) {
    event.respondWith(textResponse(400, "missing id"))
    return
  }
  if (lines.has(id)) {
    const line = lines.get(id)
    lines.delete(id)
    event.respondWith(textResponse(200, line))
    return
  }
  event.respondWith(
    new Promise((resolve) => {
      let timer = null
      const answer = (line) => {
        clearTimeout(timer)
        resolve(textResponse(200, line))
      }
      timer = setTimeout(() => {
        if (waiting.get(id) === answer) {
          waiting.delete(id)
          resolve(textResponse(204, null))
        }
      }, HOLD_MS)
      waiting.set(id, answer)
    }),
  )
})
