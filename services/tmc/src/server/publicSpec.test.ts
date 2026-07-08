import { describe, expect, it } from "vitest"

import { handlePublicSpec } from "./publicSpec"

// The happy path downloads the template and shells out to tmc-langs-cli; unit tests cover request
// validation, system tests cover the full flow.
function post(body: string): Request {
  return new Request("http://localhost/api/public-spec", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

describe("POST /api/public-spec", () => {
  it("rejects invalid JSON with 400", async () => {
    const res = await handlePublicSpec(post("not json"))
    expect(res.status).toBe(400)
  })

  it("rejects a body that is not a spec request with 400", async () => {
    const res = await handlePublicSpec(post(JSON.stringify({})))
    expect(res.status).toBe(400)
  })

  it("rejects a null private spec with 400", async () => {
    const res = await handlePublicSpec(
      post(JSON.stringify({ request_id: "1234", private_spec: null, upload_url: "http://x" })),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Private spec cannot be null")
  })

  it("rejects a missing upload URL with 400", async () => {
    const res = await handlePublicSpec(
      post(
        JSON.stringify({ request_id: "1234", private_spec: { type: "editor" }, upload_url: null }),
      ),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Missing upload URL")
  })

  it("rejects a malformed private spec with 400", async () => {
    const res = await handlePublicSpec(
      post(
        JSON.stringify({
          request_id: "1234",
          private_spec: { type: "editor" },
          upload_url: "http://x",
        }),
      ),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Invalid private spec")
  })
})
