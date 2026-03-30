import assert from "node:assert/strict"
import test from "node:test"

test("export-definitions exports option metadata", async () => {
  const importedRouteModule = await import("../export-definitions/route.ts")
  const routeModule = importedRouteModule.default ?? importedRouteModule
  const { POST } = routeModule
  const response = await POST(
    new Request("http://localhost/api/export-definitions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            private_spec: [
              { id: "id-1", name: "First option", correct: true },
              { id: "id-2", name: "Second option", correct: false },
            ],
          },
        ],
      }),
    }),
  )

  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    columns: Array<{ key: string; header: string }>
    results: Array<{ rows: Array<Record<string, unknown>> }>
  }

  assert.ok(body.columns.some((column) => column.key === "option_index"))
  assert.equal(body.results.length, 1)
  assert.equal(body.results[0].rows.length, 2)
  assert.deepEqual(body.results[0].rows[0], {
    option_index: 0,
    option_count: 2,
    option_id: "id-1",
    option_name: "First option",
    option_correct: true,
  })
})

test("export-definitions fails with invalid payload", async () => {
  const importedRouteModule = await import("../export-definitions/route.ts")
  const routeModule = importedRouteModule.default ?? importedRouteModule
  const { POST } = routeModule
  const response = await POST(
    new Request("http://localhost/api/export-definitions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: "invalid" }),
    }),
  )

  assert.equal(response.status, 400)
})
