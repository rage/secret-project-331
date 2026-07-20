import { describe, expect, it } from "vitest"

import { handleExportDefinitions } from "./exportDefinitions"

function post(body: unknown): Request {
  return new Request("http://localhost/api/export-definitions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/export-definitions", () => {
  it("exports option metadata", async () => {
    const res = await handleExportDefinitions(
      post({
        items: [
          {
            private_spec: [
              { id: "id-1", name: "First option", correct: true },
              { id: "id-2", name: "Second option", correct: false },
            ],
          },
        ],
      }),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      columns: { key: string }[]
      results: { rows: Record<string, unknown>[] }[]
    }
    expect(body.columns.some((c) => c.key === "option_index")).toBe(true)
    expect(body.results).toHaveLength(1)
    expect(body.results[0]!.rows).toHaveLength(2)
    expect(body.results[0]!.rows[0]).toEqual({
      option_index: 0,
      option_count: 2,
      option_id: "id-1",
      option_name: "First option",
      option_correct: true,
    })
  })

  it("fails with an invalid payload", async () => {
    const res = await handleExportDefinitions(post({ items: "invalid" }))
    expect(res.status).toBe(400)
  })
})
