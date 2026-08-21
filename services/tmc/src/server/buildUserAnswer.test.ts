import { describe, expect, it } from "vitest"

import { handleBuildUserAnswer } from "./buildUserAnswer"

function post(body: unknown): Request {
  return new Request("http://localhost/api/build-user-answer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

const file = {
  id: "0b3b1a6e-6c31-4a4a-8f4a-8a2b0f1f4c11",
  name: "submission.tar.zst",
  url: "http://project-331.local/api/v0/files/tmc/abc",
}

describe("POST /api/build-user-answer", () => {
  it("accepts the uploaded archive as an answer with no metadata", async () => {
    const res = await handleBuildUserAnswer(
      post({ request_id: "req", public_spec: null, uploaded_files: [file] }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ answer: null })
  })

  it("ignores the public spec, since the answer is determined by the archive alone", async () => {
    const res = await handleBuildUserAnswer(
      post({
        request_id: "req",
        public_spec: { type: "editor", repository_exercise: { id: "x" } },
        uploaded_files: [file],
      }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ answer: null })
  })

  it("rejects a request with no uploaded archive", async () => {
    const res = await handleBuildUserAnswer(
      post({ request_id: "req", public_spec: null, uploaded_files: [] }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects a request with more than one uploaded archive", async () => {
    const res = await handleBuildUserAnswer(
      post({
        request_id: "req",
        public_spec: null,
        uploaded_files: [file, { ...file, id: "second" }],
      }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects a malformed uploaded-files entry", async () => {
    const res = await handleBuildUserAnswer(
      post({ request_id: "req", public_spec: null, uploaded_files: [{ id: file.id }] }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects a body that is not JSON", async () => {
    const res = await handleBuildUserAnswer(post("not json"))
    expect(res.status).toBe(400)
  })
})
