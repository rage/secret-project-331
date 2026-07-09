import { describe, expect, it } from "vitest"

import { handleServiceInfo } from "./serviceInfo"

describe("GET /api/service-info", () => {
  it("returns the service metadata with base-path-prefixed endpoint paths", async () => {
    const res = handleServiceInfo()
    expect(res.status).toBe(200)
    const info = (await res.json()) as Record<string, string>
    // PUBLIC_BASE_PATH is unset in tests, so paths are unprefixed; basePath() applies the prefix
    // verbatim (validated end-to-end via the built server), so assert the suffixes.
    expect(info.service_name).toBe("Example exercise")
    expect(info.user_interface_iframe_path).toMatch(/\/iframe$/)
    expect(info.grade_endpoint_path).toMatch(/\/api\/grade$/)
    expect(info.public_spec_endpoint_path).toMatch(/\/api\/public-spec$/)
    expect(info.model_solution_spec_endpoint_path).toMatch(/\/api\/model-solution$/)
    expect(info.csv_export_definitions_endpoint_path).toMatch(/\/api\/export-definitions$/)
    expect(info.csv_export_answers_endpoint_path).toMatch(/\/api\/export-answers$/)
  })
})
