import path from "path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { RepositoryExercise } from "@/util/exerciseServiceApi"
import { buildArchiveName } from "@/util/helpers"

import { browserEditorFields, handlePublicSpec } from "./publicSpec"
import { uploadArchive } from "./uploadArchive"

// tmc-langs is a CLI subprocess and the template download hits the network; stub both so the
// serialization guard below can drive the handler in-process. System tests cover the full flow.
vi.mock("@/lib", () => ({
  downloadStream: vi.fn(() => Promise.resolve(undefined)),
}))
vi.mock("@/tmc/langs", () => ({
  extractProject: vi.fn(() => Promise.resolve(undefined)),
  prepareStub: vi.fn(() => Promise.resolve(undefined)),
  compressProject: vi.fn(() => Promise.resolve("checksum-abc123")),
  getExercisePackagingConfiguration: vi.fn(() =>
    Promise.resolve({
      student_file_paths: ["src/main.py"],
      exercise_file_paths: ["test/test_main.py"],
    }),
  ),
}))
// Error reporting is fire-and-forget over the network; keep it out of the tests.
vi.mock("@/shared-module/common/errors/reportErrorOccurrence", () => ({
  reportErrorOccurrence: vi.fn(() => Promise.resolve(undefined)),
}))
// The upload's own wire contract is covered by uploadArchive.test.ts; here it only needs to yield a
// URL (or throw) so the spec shape below can be asserted.
vi.mock("./uploadArchive", () => ({
  uploadArchive: vi.fn(() =>
    Promise.resolve({
      id: "c4d5e6f7-8091-4a2b-9c3d-4e5f60718293",
      url: "http://files/part01/ex01.tar.zst",
    }),
  ),
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
 * into a typed struct. Renaming or dropping a field here breaks the native client at runtime with
 * no compile-time signal on either side, so pin the exact serialized shape.
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
  const stubFileId = "c4d5e6f7-8091-4a2b-9c3d-4e5f60718293"

  function specRequest(): string {
    return JSON.stringify({
      request_id: "1234abcd",
      private_spec: { type: "editor", repository_exercise: exercise },
      upload_url: "http://headless-lms/api/v0/files/tmc",
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(uploadArchive).mockResolvedValue({ id: stubFileId, url: stubDownloadUrl })
  })

  it('returns exactly the fields tmc-langs deserializes, with `type: "editor"`', async () => {
    const res = await handlePublicSpec(post(specRequest()))
    expect(res.status).toBe(200)
    const { spec } = (await res.json()) as { spec: Record<string, unknown> }

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

  /**
   * The declaration is the only thing that keeps the stub archive: it is uploaded during this
   * derivation, so no saved spec the host can read ever mentions it, and the reaper would take it
   * for an abandoned upload. tmc re-uploads on every save, so these are also the files that
   * actually accumulate.
   */
  it("declares the uploaded stub archive as a file the spec references", async () => {
    const res = await handlePublicSpec(post(specRequest()))
    const { files } = (await res.json()) as { files: string[] }

    expect(files).toEqual([stubFileId])
  })

  it("passes the built archive name and upload target through to the upload", async () => {
    await handlePublicSpec(post(specRequest()))

    expect(uploadArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        archiveName,
        uploadUrl: "http://headless-lms/api/v0/files/tmc",
      }),
    )
  })

  it("fails loudly rather than emitting a spec without a usable stub URL", async () => {
    // A rejected upload must surface; silently producing a spec with an empty/undefined
    // stub_download_url would strand the client.
    vi.mocked(uploadArchive).mockRejectedValue(new Error("upload exploded"))

    await expect(handlePublicSpec(post(specRequest()))).rejects.toThrow(/upload exploded/)
  })
})

const exercise = (name: string): RepositoryExercise => ({
  id: "e48717c3-fd7d-41e9-a2e5-36ce06fcd943",
  repository_id: "4d24291f-dd61-43cc-83e2-4707a7278425",
  part: "part01",
  name,
  repository_url: "https://example.com/repo",
  checksum: [1],
  download_url: "http://files/template.tar.zst",
})

describe("browserEditorFields", () => {
  const testsDir = path.join(import.meta.dirname, "..", "..", "tests")

  it("opens the module the tests name and keeps only student files that are in the stub", async () => {
    const fields = await browserEditorFields(
      path.join(testsDir, "fixtures", "hello-name"),
      ["src/hello_name.py", "src/missing.py"],
      exercise("hello_name"),
    )
    expect(fields).toEqual({
      student_file_paths: ["src/hello_name.py"],
      main_file: "src/hello_name.py",
      archive_prefix: "hello_name",
    })
  })

  it("falls back to the first student file other than a package marker and makes the exercise name a safe directory", async () => {
    const fields = await browserEditorFields(
      path.join(testsDir, "util", "canonical-archive", "python_exercise"),
      ["src/main.py", "src/a-b.py", "src/a/b.py", "__init__.py"],
      exercise("part 1/ex:1"),
    )
    expect(fields).toEqual({
      student_file_paths: ["__init__.py", "src/a/b.py", "src/a-b.py", "src/main.py"],
      main_file: "src/a/b.py",
      archive_prefix: "part_1_ex_1",
    })
  })
})
