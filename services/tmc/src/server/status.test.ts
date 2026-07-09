import { describe, expect, it } from "vitest"

import { sandboxResultsHandlers } from "./sandboxResults"
import { handleServiceInfo } from "./serviceInfo"
import { handleStatusUp } from "./status"
import { testRuns } from "./testRuns"
import { handleTestrun } from "./testrun"

describe("GET /api/status/up", () => {
  it("returns true", async () => {
    const res = await handleStatusUp()
    expect(res.status).toBe(200)
    expect(await res.json()).toBe(true)
  })
})

describe("GET /api/service-info", () => {
  it("returns the plugin endpoints prefixed with the base path", async () => {
    const res = await handleServiceInfo()
    expect(res.status).toBe(200)
    const info = await res.json()
    expect(info.service_name).toBe("TMC")
    expect(info.user_interface_iframe_path.endsWith("/iframe")).toBe(true)
    expect(info.grade_endpoint_path.endsWith("/api/grade")).toBe(true)
    expect(info.public_spec_endpoint_path.endsWith("/api/public-spec")).toBe(true)
    expect(info.model_solution_spec_endpoint_path.endsWith("/api/model-solution")).toBe(true)
  })
})

describe("GET /api/testrun", () => {
  it("rejects a request without an id", async () => {
    const res = await handleTestrun(new Request("http://localhost/api/testrun"))
    expect(res.status).toBe(400)
  })

  it("returns a stored run result by id", async () => {
    testRuns.set("test-id", { status: "PASSED", testResults: [], logs: {} })
    const res = await handleTestrun(new Request("http://localhost/api/testrun?id=test-id"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "PASSED", testResults: [], logs: {} })
  })
})

describe("/api/sandbox-results", () => {
  it("returns 404 for every method", async () => {
    for (const handler of Object.values(sandboxResultsHandlers)) {
      const res = await handler()
      expect(res.status).toBe(404)
    }
  })
})
