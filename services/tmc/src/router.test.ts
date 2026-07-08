import { describe, expect, it } from "vitest"

import { getRouter } from "./router"

describe("router", () => {
  it("builds and exposes the iframe UI route and the api routes", () => {
    const router = getRouter()
    const ids = Object.keys(router.routesById)
    expect(ids.some((p) => p.includes("/iframe"))).toBe(true)
    expect(ids.some((p) => p.includes("/api/service-info"))).toBe(true)
    expect(ids.some((p) => p.includes("/api/grade"))).toBe(true)
    expect(ids.some((p) => p.includes("/api/status/up"))).toBe(true)
    expect(ids.some((p) => p.includes("/api/test"))).toBe(true)
    expect(ids.some((p) => p.includes("/api/testrun"))).toBe(true)
    expect(ids.some((p) => p.includes("/api/extract-stub"))).toBe(true)
  })
})
