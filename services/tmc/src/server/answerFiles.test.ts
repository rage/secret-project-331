import { describe, expect, it } from "vitest"

import { handleAnswerFiles } from "./answerFiles"

function post(body: unknown): Request {
  return new Request("http://localhost/api/answer-files", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

describe("POST /api/answer-files", () => {
  it("reports no files for any answer", async () => {
    const res = await handleAnswerFiles(post({ request_id: "req", answer: null }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ files: [] })
  })

  it("rejects a request without a request id", async () => {
    const res = await handleAnswerFiles(post({ answer: null }))
    expect(res.status).toBe(400)
  })

  it("rejects a body that is not JSON", async () => {
    const res = await handleAnswerFiles(post("not json"))
    expect(res.status).toBe(400)
  })
})
