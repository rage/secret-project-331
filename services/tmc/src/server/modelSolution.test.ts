import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"

import { handleModelSolution } from "./modelSolution"
import { uploadArchiveAndGetUrl } from "./uploadArchive"

// tmc-langs is a CLI subprocess and the template download hits the network; stub both so the
// serialization guard below can drive the handler in-process. System tests cover the full flow.
vi.mock("@/lib", () => ({
  downloadStream: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock("@/tmc/langs", () => ({
  extractProject: vi.fn(() => Promise.resolve(undefined)),
  prepareSolution: vi.fn(() => Promise.resolve(undefined)),
  compressProject: vi.fn(() => Promise.resolve("checksum-abc123")),
}))
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock("./uploadArchive", () => ({
  uploadArchiveAndGetUrl: vi.fn(() => Promise.resolve("http://files/part01/ex01-solution.tar.zst")),
}))

// The happy path downloads the template and shells out to tmc-langs-cli; unit tests cover request
// validation, system tests cover the full flow.
function post(body: unknown): Request {
  return new Request("http://localhost/api/model-solution", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/model-solution", () => {
  it("rejects a body that is not a spec request with 400", async () => {
    const res = await handleModelSolution(post({}))
    expect(res.status).toBe(400)
  })

  it("rejects a null private spec with 400", async () => {
    const res = await handleModelSolution(
      post({ request_id: "1234", private_spec: null, upload_url: "http://x" }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Missing private spec")
  })

  it("rejects a missing upload URL with 400", async () => {
    const res = await handleModelSolution(
      post({ request_id: "1234", private_spec: { type: "editor" }, upload_url: null }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Missing upload URL")
  })

  it("rejects a malformed private spec with 400", async () => {
    const res = await handleModelSolution(
      post({ request_id: "1234", private_spec: { type: "editor" }, upload_url: "http://x" }),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("Invalid private spec")
  })
})

/**
 * The ModelSolutionSpec crosses a process and a language boundary: tmc-langs-rust deserializes it
 * into a typed struct (`crates/tmc-mooc-client/src/exercise.rs`), and the backend forwards it to
 * native clients whenever the model solution may be revealed. Renaming or dropping a field here
 * breaks those clients at runtime with no compile-time signal on either side, so pin the exact
 * serialized shape.
 */
describe("POST /api/model-solution spec serialization", () => {
  const exercise: RepositoryExercise = {
    id: "e1",
    repository_id: "r1",
    part: "part01",
    name: "ex01",
    repository_url: "http://repo",
    checksum: [1, 2, 3],
    download_url: "http://repo/template.tar.zst",
  }
  const solutionDownloadUrl = "http://files/part01/ex01-solution.tar.zst"

  function specRequest(type: "browser" | "editor"): unknown {
    return {
      request_id: "1234abcd",
      private_spec: { type, repository_exercise: exercise },
      upload_url: "http://headless-lms/api/v0/files/tmc",
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(uploadArchiveAndGetUrl).mockResolvedValue(solutionDownloadUrl)
  })

  it("returns exactly the fields tmc-langs deserializes, tagged with the exercise type", async () => {
    const res = await handleModelSolution(post(specRequest("editor")))
    expect(res.status).toBe(200)
    const spec = (await res.json()) as Record<string, unknown>

    expect(spec).toEqual({ type: "editor", solution_download_url: solutionDownloadUrl })
    expect(Object.keys(spec).toSorted()).toEqual(["solution_download_url", "type"])
  })

  it("tags a browser exercise's solution as browser", async () => {
    const res = await handleModelSolution(post(specRequest("browser")))
    expect(res.status).toBe(200)
    const spec = (await res.json()) as Record<string, unknown>

    expect(spec).toEqual({ type: "browser", solution_download_url: solutionDownloadUrl })
  })

  it("uploads the solution under `<part>/<name>-solution.tar.zst`", async () => {
    await handleModelSolution(post(specRequest("editor")))

    expect(uploadArchiveAndGetUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveName: "part01/ex01-solution.tar.zst",
        uploadUrl: "http://headless-lms/api/v0/files/tmc",
      }),
    )
  })

  it("fails loudly rather than emitting a spec without a usable solution URL", async () => {
    vi.mocked(uploadArchiveAndGetUrl).mockRejectedValue(new Error("upload exploded"))

    await expect(handleModelSolution(post(specRequest("editor")))).rejects.toThrow(
      /upload exploded/,
    )
  })
})
