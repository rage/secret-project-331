import { describe, expect, it } from "vitest"

import { handleModelSolution } from "./modelSolution"

function post(body: unknown): Request {
  return new Request("http://localhost/api/model-solution", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/model-solution", () => {
  it("returns the ids of the correct options", async () => {
    const res = await handleModelSolution(
      post({
        request_id: "r1",
        upload_url: null,
        private_spec: [
          { id: "a", name: "Right", correct: true },
          { id: "b", name: "Wrong", correct: false },
          { id: "c", name: "Also right", correct: true },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const solution = (await res.json()) as { correctOptionIds: string[] }
    expect(solution.correctOptionIds).toEqual(["a", "c"])
  })

  it("rejects an invalid request with 400", async () => {
    const res = await handleModelSolution(post({}))
    expect(res.status).toBe(400)
  })
})
