import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import { buildArchiveName } from "@/util/helpers"

import { handlePublicSpec } from "./publicSpec"

// The happy path downloads the template and shells out to tmc-langs-cli; unit tests cover request
// validation plus the serialization shape of the returned PublicSpec (with tmc-langs and the file
// upload mocked), system tests cover the full flow.

// tmc-langs is a CLI subprocess and the template download hits the network; stub both so the
// serialization guard below can drive the handler in-process.
vi.mock("@/lib", () => ({
  downloadStream: vi.fn(async () => undefined),
}))
vi.mock("@/tmc/langs", () => ({
  extractProject: vi.fn(async () => undefined),
  prepareStub: vi.fn(async () => undefined),
  compressProject: vi.fn(async () => "checksum-abc123"),
  getExercisePackagingConfiguration: vi.fn(async () => ({
    student_file_paths: ["src/main.py"],
    exercise_file_paths: ["test/test_main.py"],
  })),
}))
// Error reporting is fire-and-forget over the network; keep it out of the tests.
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(async () => undefined),
}))

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

/**
 * The editor PublicSpec crosses a process and a language boundary: tmc-langs-rust deserializes it
 * into a typed struct (the same way `EditorAnswer` in
 * `services/headless-lms/server/src/domain/exercise_services/tmc_editor_answer.rs` mirrors this
 * service's `EditorUserAnswer`). Renaming or dropping a field here breaks the native client at
 * runtime with no compile-time signal on either side, so pin the exact serialized shape.
 */
describe("POST /api/public-spec editor spec serialization", () => {
  const exercise: RepositoryExercise = {
    id: "e1",
    repository_id: "r1",
    part: "part01",
    name: "ex01",
    repository_url: "http://repo",
    checksum: [1, 2, 3],
    download_url: "http://repo/template.tar.zst",
  }
  const archiveName = buildArchiveName(exercise)
  const stubDownloadUrl = "http://files/part01/ex01.tar.zst"

  function specRequest(): string {
    return JSON.stringify({
      request_id: "1234abcd",
      private_spec: { type: "editor", repository_exercise: exercise },
      upload_url: "http://headless-lms/api/v0/files/tmc",
    })
  }

  /** Mocks the file-upload endpoint's JSON response body. */
  function mockUploadResponse(body: unknown): void {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as unknown as typeof global.fetch
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns exactly the fields tmc-langs deserializes, with `type: "editor"`', async () => {
    mockUploadResponse({ [archiveName]: stubDownloadUrl })

    const res = await handlePublicSpec(post(specRequest()))
    expect(res.status).toBe(200)
    const spec = (await res.json()) as Record<string, unknown>

    expect(spec).toEqual({
      type: "editor",
      archive_name: archiveName,
      stub_download_url: stubDownloadUrl,
      checksum: "checksum-abc123",
      student_file_paths: ["src/main.py"],
    })
    // No extra keys leak in, and `browser_test` is absent for an editor exercise.
    expect(Object.keys(spec).toSorted()).toEqual([
      "archive_name",
      "checksum",
      "stub_download_url",
      "student_file_paths",
      "type",
    ])
    expect(spec).not.toHaveProperty("browser_test")
    // `type` is the literal discriminant, not the exercise's own type field.
    expect(spec.type).toBe("editor")
    // The archive name is `<part>/<name>.tar.zst`; the URL comes from the upload response keyed by
    // exactly that name.
    expect(spec.archive_name).toBe("part01/ex01.tar.zst")
  })

  it("fails loudly when the upload response is missing the archive key", async () => {
    // The upload responded successfully but keyed the URL under a different name; silently
    // producing a spec with an empty/undefined stub_download_url would strand the client.
    mockUploadResponse({ "some-other-name.tar.zst": stubDownloadUrl })

    await expect(handlePublicSpec(post(specRequest()))).rejects.toThrow(
      /missing or invalid archive key/,
    )
  })

  it("fails loudly when the archive key maps to an empty URL", async () => {
    mockUploadResponse({ [archiveName]: "" })

    await expect(handlePublicSpec(post(specRequest()))).rejects.toThrow(
      /missing or invalid archive key/,
    )
  })

  it("fails loudly when the archive key maps to a non-string value", async () => {
    mockUploadResponse({ [archiveName]: 42 })

    await expect(handlePublicSpec(post(specRequest()))).rejects.toThrow(
      /missing or invalid archive key/,
    )
  })

  it("fails loudly when the upload response is not an object", async () => {
    mockUploadResponse("nope")

    await expect(handlePublicSpec(post(specRequest()))).rejects.toThrow(
      /missing or invalid archive key/,
    )
  })
})
