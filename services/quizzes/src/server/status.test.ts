import { describe, expect, it } from "vitest"

import { handleStatusUp } from "./status"

describe("GET /api/status/up", () => {
  it("returns true", async () => {
    const res = await handleStatusUp()
    expect(res.status).toBe(200)
    expect(await res.json()).toBe(true)
  })
})
