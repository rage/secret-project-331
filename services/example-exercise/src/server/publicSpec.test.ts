import { describe, expect, it } from "vitest"

import { handlePublicSpec } from "./publicSpec"

function post(body: unknown): Request {
  return new Request("http://localhost/api/public-spec", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/public-spec", () => {
  it("strips the `correct` flag so answers never reach the browser", async () => {
    const res = await handlePublicSpec(
      post({
        request_id: "r1",
        upload_url: null,
        private_spec: [
          { id: "a", name: "Right", correct: true },
          { id: "b", name: "Wrong", correct: false },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const spec = (await res.json()) as Record<string, unknown>[]
    expect(spec).toEqual([
      { id: "a", name: "Right" },
      { id: "b", name: "Wrong" },
    ])
    expect(JSON.stringify(spec)).not.toContain("correct")
  })

  it("accepts a versioned private_spec envelope and still strips `correct` (migrate-on-read)", async () => {
    const res = await handlePublicSpec(
      post({
        request_id: "r1",
        upload_url: null,
        private_spec: {
          version: "1",
          alternatives: [
            { id: "a", name: "Right", correct: true },
            { id: "b", name: "Wrong", correct: false },
          ],
        },
      }),
    )
    expect(res.status).toBe(200)
    const spec = (await res.json()) as Record<string, unknown>[]
    // Output stays a bare array (smoke.mjs asserts Array.isArray) with no `correct`.
    expect(Array.isArray(spec)).toBe(true)
    expect(spec).toEqual([
      { id: "a", name: "Right" },
      { id: "b", name: "Wrong" },
    ])
    expect(JSON.stringify(spec)).not.toContain("correct")
  })

  it("rejects a request that is not a spec request with 400", async () => {
    const res = await handlePublicSpec(post({}))
    expect(res.status).toBe(400)
  })

  it("rejects a non-array private_spec with 400", async () => {
    const res = await handlePublicSpec(
      post({ request_id: "r1", upload_url: null, private_spec: "x" }),
    )
    expect(res.status).toBe(400)
  })
})
