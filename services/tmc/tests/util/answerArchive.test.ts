import { readFile } from "fs/promises"

import { afterEach, describe, expect, it, vi } from "vitest"

import { initialEditorFiles, packBrowserAnswer } from "@/util/answerArchive"
import type { PublicSpec } from "@/util/stateInterfaces"

const ARCHIVE_HOST = "http://files.example/"

const BROWSER_SPEC: PublicSpec = {
  type: "browser",
  archive_name: "part01-ex01.tar.zst",
  stub_download_url: "http://files.example/stub.tar.zst",
  student_file_paths: [],
  checksum: "abc",
}

/**
 * Serves the test archive for every `files.example` URL and records which ones were asked for.
 * Anything else falls through to the real fetch: zstddec loads its wasm decoder that way.
 */
async function stubArchiveResponses(): Promise<string[]> {
  const requested: string[] = []
  const archive = await readFile("./tests/util/test.tar.zst")
  const realFetch = globalThis.fetch
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (!url.startsWith(ARCHIVE_HOST)) {
        return realFetch(input, init)
      }
      requested.push(url)
      return Promise.resolve(new Response(new Uint8Array(archive), { status: 200 }))
    }),
  )
  return requested
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("initialEditorFiles", () => {
  it("seeds the editor from the exercise stub", async () => {
    const requested = await stubArchiveResponses()
    const files = await initialEditorFiles(BROWSER_SPEC, null)
    expect(requested).toEqual([BROWSER_SPEC.stub_download_url])
    expect(files).toHaveLength(1)
  })

  it("seeds from a previous submission's archive instead of the stub when there is one", async () => {
    const requested = await stubArchiveResponses()
    await initialEditorFiles(BROWSER_SPEC, "http://files.example/previous.tar.zst")
    expect(requested).toEqual(["http://files.example/previous.tar.zst"])
  })

  it("gives an editor-mode exercise no editor files", async () => {
    const requested = await stubArchiveResponses()
    const files = await initialEditorFiles({ ...BROWSER_SPEC, type: "editor" }, null)
    expect(files).toEqual([])
    expect(requested).toEqual([])
  })
})

describe("packBrowserAnswer", () => {
  it("uploads the packed archive bytes under a name the host can serve", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))),
    )
    const archive = await packBrowserAnswer([{ filepath: "src/main.py", contents: "print(1)" }])
    expect(archive.name).toBe("submission.tar.zst")
    expect([...new Uint8Array(await archive.arrayBuffer())]).toEqual([1, 2, 3])
  })

  it("fails rather than uploading nothing when packing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("nope", { status: 500 }))),
    )
    await expect(packBrowserAnswer([{ filepath: "a.py", contents: "x" }])).rejects.toThrow("500")
  })
})
