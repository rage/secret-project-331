import { promises as fsPromises } from "fs"
import * as os from "os"
import * as path from "path"
import { PassThrough } from "stream"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER } from "@/shared-module/exercise-protocol/server/exerciseServices"

import { uploadArchiveAndGetUrl } from "./uploadArchive"

/** Reads a `form-data` request body and returns the multipart part name (the upload id). */
async function readUploadId(body: unknown): Promise<string> {
  // `form-data` is an old-style stream, not async-iterable; pipe it into a PassThrough to read it.
  const sink = new PassThrough()
  ;(body as NodeJS.ReadableStream).pipe(sink)
  const chunks: Buffer[] = []
  for await (const chunk of sink) {
    chunks.push(Buffer.from(chunk as Buffer))
  }
  const match = /name="([^"]+)"/.exec(Buffer.concat(chunks).toString("utf8"))
  if (!match?.[1]) {
    throw new Error("no multipart part name in the request body")
  }
  return match[1]
}

/** Reads the headers the mocked fetch was last called with. */
function sentHeaders(): Record<string, string> {
  const init = vi.mocked(global.fetch).mock.calls[0]?.[1]
  if (!init) {
    throw new Error("fetch was not called")
  }
  return init.headers as Record<string, string>
}

/**
 * `uploadArchiveAndGetUrl` is the only place that validates the file endpoint's response, and its
 * failure mode is silent: a spec carrying an empty or wrong `stub_download_url` looks fine to the
 * backend and only breaks when a client tries to download the archive. Pin the accepted shape.
 */
describe("uploadArchiveAndGetUrl", () => {
  const archiveName = "part01/ex01.tar.zst"
  const uploadUrl = "http://headless-lms/api/v0/files/tmc"
  let archivePath: string

  /** Mocks the file endpoint with a fixed JSON response body. */
  function mockResponse(body: unknown, status = 200): void {
    mockResponseWith(() => body, status)
  }

  /**
   * Mocks the file endpoint with a body built from the upload id the client actually generated. The
   * real endpoint echoes that id back, and it is a random UUID internal to
   * `uploadArchiveAndGetUrl`, so it has to be read off the outgoing multipart body.
   */
  function mockResponseWith(build: (uploadId: string) => unknown, status = 200): void {
    global.fetch = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = build(await readUploadId(init.body))
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      })
    }) as unknown as typeof global.fetch
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    archivePath = path.join(
      await fsPromises.mkdtemp(path.join(os.tmpdir(), "upload-")),
      "a.tar.zst",
    )
    await fsPromises.writeFile(archivePath, "archive contents")
  })

  afterEach(async () => {
    await fsPromises.rm(path.dirname(archivePath), { recursive: true, force: true })
  })

  function upload(uploadClaim: string | null = null): Promise<string> {
    return uploadArchiveAndGetUrl({ archivePath, archiveName, uploadUrl, uploadClaim })
  }

  it("returns the URL the endpoint reported for the upload id", async () => {
    mockResponseWith((id) => [{ id, url: "http://files/part01/ex01.tar.zst" }])

    await expect(upload()).resolves.toBe("http://files/part01/ex01.tar.zst")
  })

  it("sends the upload claim header when one is given, and omits it otherwise", async () => {
    mockResponseWith((id) => [{ id, url: "http://files/a" }])
    await upload("claim-abc")
    expect(sentHeaders()[EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER]).toBe("claim-abc")

    mockResponseWith((id) => [{ id, url: "http://files/a" }])
    await upload(null)
    expect(sentHeaders()).not.toHaveProperty(EXERCISE_SERVICE_UPLOAD_CLAIM_HEADER)
  })

  it("rejects a URL reported under a different upload id", async () => {
    mockResponse([{ id: "some-other-id", url: "http://files/a" }])

    await expect(upload()).rejects.toThrow(/Unexpected upload response/)
  })

  it("rejects an empty URL", async () => {
    mockResponseWith((id) => [{ id, url: "" }])

    await expect(upload()).rejects.toThrow(/Unexpected upload response/)
  })

  it("rejects a non-string URL", async () => {
    mockResponseWith((id) => [{ id, url: 42 }])

    await expect(upload()).rejects.toThrow(/Unexpected upload response/)
  })

  it("rejects a response carrying more than the one requested upload", async () => {
    mockResponseWith((id) => [
      { id, url: "http://files/a" },
      { id, url: "http://files/b" },
    ])

    await expect(upload()).rejects.toThrow(/Unexpected upload response/)
  })

  it("rejects a response that is not an array", async () => {
    mockResponse({ [archiveName]: "http://files/a" })

    await expect(upload()).rejects.toThrow(/Unexpected upload response/)
  })

  it("reports a non-2xx response as an upload failure", async () => {
    mockResponse({ message: "nope" }, 500)

    await expect(upload()).rejects.toThrow(/Upload failed: 500/)
  })
})
