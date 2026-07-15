import { describe, expect, it } from "vitest"

import { handleTest } from "./testEndpoint"

// The happy path runs the submission in a Kubernetes sandbox pod; unit tests cover request
// validation, system tests cover the full flow.
function post(body: string): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

describe("POST /api/test", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await handleTest(post("not json"))
    expect(res.status).toBe(400)
  })

  it("rejects a body that is not a test request with 400", async () => {
    const res = await handleTest(post(JSON.stringify({})))
    expect(res.status).toBe(400)
  })

  it("rejects a browser test request with malformed files with 400", async () => {
    const res = await handleTest(
      post(
        JSON.stringify({
          type: "browser",
          templateDownloadUrl: "http://x",
          files: [{ filepath: 1 }],
        }),
      ),
    )
    expect(res.status).toBe(400)
  })

  it("rejects an editor test request without an archive URL with 400", async () => {
    const res = await handleTest(
      post(JSON.stringify({ type: "editor", templateDownloadUrl: "http://x" })),
    )
    expect(res.status).toBe(400)
  })
})
