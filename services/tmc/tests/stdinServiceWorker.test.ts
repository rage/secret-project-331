// @vitest-environment node
import { readFileSync } from "node:fs"
import path from "node:path"
import { runInNewContext } from "node:vm"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const SCRIPT = readFileSync(
  path.join(import.meta.dirname, "..", "public", "stdinServiceWorker.js"),
  "utf8",
)
const STDIN_URL = "http://project-331.local/tmc/__stdin"

type Listener = (event: unknown) => void

/** Evaluates the service worker script against a fake global scope and returns its listeners. */
function loadServiceWorker() {
  const listeners = new Map<string, Listener>()
  const scope = {
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
  }
  runInNewContext(SCRIPT, { self: scope, Response, URL, Map, String, setTimeout, clearTimeout })
  const fetchEvent = (url: string) => {
    let response: Promise<Response> | Response | undefined
    listeners.get("fetch")?.({
      request: { url },
      respondWith: (r: Promise<Response> | Response) => (response = r),
    })
    return response === undefined ? undefined : Promise.resolve(response)
  }
  const postLine = (id: string, line: string) =>
    listeners.get("message")?.({ data: { type: "stdin_line", id, line } })
  return { fetchEvent, postLine }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("stdinServiceWorker.js", () => {
  it("answers the probe so a worker can tell it is controlled", async () => {
    const response = await loadServiceWorker().fetchEvent(`${STDIN_URL}?probe`)
    expect(await response?.text()).toBe("ready")
  })

  it("holds a request until the page posts its line", async () => {
    const sw = loadServiceWorker()
    const pending = sw.fetchEvent(`${STDIN_URL}?id=a`)
    sw.postLine("a", "Ada")
    const response = await pending
    expect(response?.status).toBe(200)
    expect(await response?.text()).toBe("Ada")
  })

  it("keeps a line that arrives before its request", async () => {
    const sw = loadServiceWorker()
    sw.postLine("b", "Grace")
    expect(await (await sw.fetchEvent(`${STDIN_URL}?id=b`))?.text()).toBe("Grace")
  })

  it("keeps requests of different input() calls apart", async () => {
    const sw = loadServiceWorker()
    const first = sw.fetchEvent(`${STDIN_URL}?id=one`)
    const second = sw.fetchEvent(`${STDIN_URL}?id=two`)
    sw.postLine("two", "2")
    sw.postLine("one", "1")
    expect(await (await first)?.text()).toBe("1")
    expect(await (await second)?.text()).toBe("2")
  })

  it("lets a long wait ask again rather than hold the request open for minutes", async () => {
    const sw = loadServiceWorker()
    const pending = sw.fetchEvent(`${STDIN_URL}?id=c`)
    await vi.advanceTimersByTimeAsync(30_000)
    expect((await pending)?.status).toBe(204)
    const retry = sw.fetchEvent(`${STDIN_URL}?id=c`)
    sw.postLine("c", "late")
    expect(await (await retry)?.text()).toBe("late")
  })

  it("leaves every other request to the network", () => {
    expect(loadServiceWorker().fetchEvent("http://project-331.local/tmc/iframe")).toBeUndefined()
  })
})
