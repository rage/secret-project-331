// @vitest-environment node
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { answerPreflight } from "../../iframe-headers.mjs"

let server: Server
let origin: string

beforeAll(async () => {
  server = createServer((req, res) => {
    if (answerPreflight(req, res)) {
      return
    }
    res.writeHead(200, { "Content-Type": "text/html" })
    res.end("<!doctype html>")
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => {
    server.close(resolve)
  })
})

describe("CORS preflight", () => {
  it("answers OPTIONS with 204 and the headers a browser JSON POST needs", async () => {
    const res = await fetch(`${origin}/api/public-spec`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://courses.mooc.fi",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe("*")
    expect(res.headers.get("access-control-allow-methods")).toContain("POST")
    expect(res.headers.get("access-control-allow-headers")?.toLowerCase()).toContain("content-type")
    expect(Number(res.headers.get("access-control-max-age"))).toBeGreaterThan(0)
    expect(await res.text()).toBe("")
  })

  it("lets other methods through to routing", async () => {
    const res = await fetch(`${origin}/iframe`)
    expect(res.status).toBe(200)
  })
})
